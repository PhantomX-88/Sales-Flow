import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildCsv } = require("../lib/utils.ts");
const { resolveSiteUrl } = require("../lib/server/mailer.ts");

test("CSV exports neutralize formula-like strings and preserve numeric values", () => {
  assert.equal(
    buildCsv([["=1+1", "plain text", -42], ["\t@SUM(A1:A2)", " +1", 0]]),
    "'=1+1,plain text,-42\n'\t@SUM(A1:A2),' +1,0",
  );
});

test("configured production invitation origin ignores the request Origin header", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  process.env.NODE_ENV = "production";
  process.env.SITE_URL = "https://sales.example.com/";

  try {
    const request = new Request("https://sales.example.com/api/team/invite", {
      headers: { origin: "https://attacker.example" },
    });
    assert.equal(resolveSiteUrl(request), "https://sales.example.com");
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousSiteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previousSiteUrl;
  }
});

test("production invitations fail closed when SITE_URL is missing or unsafe", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  process.env.NODE_ENV = "production";

  try {
    delete process.env.SITE_URL;
    assert.throws(() => resolveSiteUrl(new Request("https://sales.example.com")), /SITE_URL must be configured/);

    process.env.SITE_URL = "http://sales.example.com";
    assert.throws(() => resolveSiteUrl(new Request("https://sales.example.com")), /HTTPS origin/);

    process.env.SITE_URL = "javascript:alert(1)";
    assert.throws(() => resolveSiteUrl(new Request("https://sales.example.com")), /HTTPS origin/);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousSiteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previousSiteUrl;
  }
});
