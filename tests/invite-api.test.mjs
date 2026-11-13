// Phase 2 API tests — zero dependencies (node:test + global fetch).
//
// Prerequisites:
//   1. Start the app against a NON-PRODUCTION Supabase project.
//   2. Set SALESFLOW_BASE_URL explicitly (loopback only by default).
//   3. For owner-only flows, set TEST_OWNER_TOKEN and TEST_ORG_ID.
//
// Run:
//   $env:SALESFLOW_BASE_URL = "http://127.0.0.1:3100"
//   npm run test:api
//
// Remote targets are blocked unless ALLOW_REMOTE_API_TESTS=1 is set.
// Never run state-changing tests against production.

import assert from "node:assert/strict";
import test from "node:test";

const configuredBase = process.env.SALESFLOW_BASE_URL;
if (!configuredBase) {
  throw new Error("Set SALESFLOW_BASE_URL explicitly before running invitation API tests.");
}

let parsedBase;
try {
  parsedBase = new URL(configuredBase);
} catch {
  throw new Error("SALESFLOW_BASE_URL must be a valid absolute HTTP(S) URL.");
}

if (
  !["http:", "https:"].includes(parsedBase.protocol) ||
  parsedBase.username ||
  parsedBase.password
) {
  throw new Error("SALESFLOW_BASE_URL must be an HTTP(S) URL without embedded credentials.");
}

const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(parsedBase.hostname);
if (!isLoopback && process.env.ALLOW_REMOTE_API_TESTS !== "1") {
  throw new Error(
    "Remote API tests are disabled. Set ALLOW_REMOTE_API_TESTS=1 only for a non-production QA project.",
  );
}

const BASE = parsedBase.origin;
const OWNER_TOKEN = process.env.TEST_OWNER_TOKEN;
const ORG_ID = process.env.TEST_ORG_ID;
const MISSING_CREDS = "Set TEST_OWNER_TOKEN and TEST_ORG_ID to run this owner-only test.";

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

test("configured app responds before API tests run", async () => {
  const response = await fetch(BASE);
  assert.equal(response.status, 200, `Expected ${BASE} to serve the app`);
});

test("invite route rejects requests without an access token", async () => {
  const { status } = await post(
    "/api/team/invite",
    { organizationId: ORG_ID, email: uniqueEmail() },
    null,
  );
  assert.equal(status, 401);
});

test("invite route rejects a malformed organization id", {
  skip: !OWNER_TOKEN && MISSING_CREDS,
}, async () => {
  const { status } = await post("/api/team/invite", {
    organizationId: "not-a-uuid",
    email: uniqueEmail(),
  });
  assert.equal(status, 400);
});

test("invite route rejects an invalid email", {
  skip: (!OWNER_TOKEN || !ORG_ID) && MISSING_CREDS,
}, async () => {
  const { status } = await post("/api/team/invite", {
    organizationId: ORG_ID,
    email: "not-an-email",
  });
  assert.equal(status, 400);
});

test("full flow: invite, lookup, duplicate, revoke, and reject resend", {
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

  const token = new URL(created.json.acceptUrl).searchParams.get("token");
  assert.ok(token);
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

test("resend rotates the invitation token and invalidates the old link", {
  skip: (!OWNER_TOKEN || !ORG_ID) && MISSING_CREDS,
}, async () => {
  const email = uniqueEmail();
  const created = await post("/api/team/invite", { organizationId: ORG_ID, email });
  assert.equal(created.status, 200, JSON.stringify(created.json));

  const oldToken = new URL(created.json.acceptUrl).searchParams.get("token");
  assert.ok(oldToken);

  const resent = await post("/api/team/resend", {
    organizationId: ORG_ID,
    invitationId: created.json.invitationId,
  });
  assert.equal(resent.status, 200, JSON.stringify(resent.json));

  const newToken = new URL(resent.json.acceptUrl).searchParams.get("token");
  assert.ok(newToken);
  assert.notEqual(newToken, oldToken);

  const oldLookup = await lookup(oldToken);
  assert.equal(oldLookup.status, 404, "old link must be invalid after resend");

  const newLookup = await lookup(newToken);
  assert.equal(newLookup.status, 200, "new link must work");

  const revoked = await post("/api/team/revoke", {
    organizationId: ORG_ID,
    invitationId: created.json.invitationId,
  });
  assert.equal(revoked.status, 200, JSON.stringify(revoked.json));
});

test("lookup rejects unknown tokens with 404", async () => {
  const { status } = await lookup("definitely-not-a-real-invite-token-1234567890");
  assert.equal(status, 404);
});

test("service-role credentials never appear in the client HTML", async () => {
  const response = await fetch(BASE);
  const html = await response.text();
  assert.ok(!html.includes("service_role"), "service-role key leaked into HTML");
  assert.ok(!html.includes("SUPABASE_SERVICE_ROLE_KEY"), "service-role env var name leaked into HTML");
});
