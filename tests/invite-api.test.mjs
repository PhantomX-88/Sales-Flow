import assert from "node:assert/strict";
import test from "node:test";

// Start the app on a fixed port and set SALESFLOW_BASE_URL to that origin.
// Add TEST_OWNER_TOKEN and TEST_ORG_ID to run state-changing invitation flows.
// Remote targets require ALLOW_REMOTE_API_TESTS=1 and must be non-production.

const configuredBase = process.env.SALESFLOW_BASE_URL;
if (!configuredBase) {
  throw new Error("Set SALESFLOW_BASE_URL explicitly before running the invitation API tests.");
}

const baseUrl = new URL(configuredBase);
if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
  throw new Error("SALESFLOW_BASE_URL must be an HTTP(S) URL without embedded credentials.");
}

const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname);
if (!isLoopback && process.env.ALLOW_REMOTE_API_TESTS !== "1") {
  throw new Error("Remote API tests are disabled. Set ALLOW_REMOTE_API_TESTS=1 only for a non-production QA project.");
}

const BASE = baseUrl.origin;
const OWNER_TOKEN = process.env.TEST_OWNER_TOKEN;
const ORG_ID = process.env.TEST_ORG_ID;
const MISSING_CREDS = "set TEST_OWNER_TOKEN and TEST_ORG_ID to run";

test("configured app responds before API tests run", async () => {
  const response = await fetch(BASE);
  assert.equal(response.status, 200, `Expected ${BASE} to serve the app`);
});

function uniqueEmail() {
  return `qa-invite-${Date.now()}-${Math.floor(Math.random() * 1e6)}@phase2.test`;
}

async function post(path, body, token = OWNER_TOKEN) {
  const response = await fetch(new URL(path, BASE), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

async function lookup(token) {
  const url = new URL("/api/invite/lookup", BASE);
  url.searchParams.set("token", token);
  const response = await fetch(url);
  return { status: response.status, json: await response.json().catch(() => null) };
}

test("invite route rejects requests without an access token", async () => {
  const { status } = await post("/api/team/invite", { organizationId: ORG_ID, email: uniqueEmail() }, null);
  assert.equal(status, 401);
});

test("invite route rejects a malformed organization id", { skip: !OWNER_TOKEN && MISSING_CREDS }, async () => {
  const { status } = await post("/api/team/invite", { organizationId: "not-a-uuid", email: uniqueEmail() });
  assert.equal(status, 400);
});

test("invite route rejects an invalid email", { skip: (!OWNER_TOKEN || !ORG_ID) && MISSING_CREDS }, async () => {
  const { status } = await post("/api/team/invite", { organizationId: ORG_ID, email: "not-an-email" });
  assert.equal(status, 400);
});

test("full flow: invite → lookup → duplicate 409 → revoke → 410 → resend 409", {
  skip: (!OWNER_TOKEN || !ORG_ID) && MISSING_CREDS,
}, async () => {
  const email = uniqueEmail();

  const created = await post("/api/team/invite", {
    organizationId: ORG_ID,
    email,
    fullName: "QA Bot",
    personalTarget: 1000,
    targetPeriod: "monthly",
  });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  assert.match(created.json.acceptUrl, /\/accept-invite\?token=.{20,}/);
  assert.ok(created.json.invitationId);

  const token = created.json.acceptUrl.split("token=")[1];
  const info = await lookup(token);
  assert.equal(info.status, 200, JSON.stringify(info.json));
  assert.equal(info.json.email, email);
  assert.ok(info.json.organizationName.length > 0);

  const duplicate = await post("/api/team/invite", { organizationId: ORG_ID, email });
  assert.equal(duplicate.status, 409);

  const revoked = await post("/api/team/revoke", {
    organizationId: ORG_ID,
    invitationId: created.json.invitationId,
  });
  assert.equal(revoked.status, 200, JSON.stringify(revoked.json));

  const afterRevoke = await lookup(token);
  assert.equal(afterRevoke.status, 410);

  const resend = await post("/api/team/resend", {
    organizationId: ORG_ID,
    invitationId: created.json.invitationId,
  });
  assert.equal(resend.status, 409);
});

test("resend issues a new token that invalidates the old link", {
  skip: (!OWNER_TOKEN || !ORG_ID) && MISSING_CREDS,
}, async () => {
  const email = uniqueEmail();
  const created = await post("/api/team/invite", { organizationId: ORG_ID, email });
  assert.equal(created.status, 200, JSON.stringify(created.json));
  const oldToken = created.json.acceptUrl.split("token=")[1];

  const resent = await post("/api/team/resend", {
    organizationId: ORG_ID,
    invitationId: created.json.invitationId,
  });
  assert.equal(resent.status, 200, JSON.stringify(resent.json));
  const newToken = resent.json.acceptUrl.split("token=")[1];
  assert.notEqual(newToken, oldToken);

  const oldLookup = await lookup(oldToken);
  assert.equal(oldLookup.status, 404, "old link must be dead after resend");

  const newLookup = await lookup(newToken);
  assert.equal(newLookup.status, 200, "new link must work");

  await post("/api/team/revoke", { organizationId: ORG_ID, invitationId: created.json.invitationId });
});

test("lookup rejects unknown tokens with 404", async () => {
  const { status } = await lookup("definitely-not-a-real-invite-token-1234567890");
  assert.equal(status, 404);
});

test("service-role credentials never appear in the client HTML", async () => {
  const response = await fetch(new URL("/", BASE));
  const html = await response.text();
  assert.ok(!html.includes("service_role"), "service-role key leaked into HTML");
  assert.ok(!html.includes("SUPABASE_SERVICE_ROLE_KEY"), "service-role env var name leaked into HTML");
});
