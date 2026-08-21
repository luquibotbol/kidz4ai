import { test } from "node:test";
import assert from "node:assert/strict";
import { roleFor } from "../lib/roles.ts";
import { decodeIdToken, redirectUri } from "../lib/oauth.ts";

process.env.KID_EMAIL = "kid@example.com";
process.env.PARENT_EMAIL = "parent@example.com";

// Spec 07 acceptance test 1 — the security-critical one.
test("only the two allowlisted addresses get a role", () => {
  assert.equal(roleFor("kid@example.com"), "kid");
  assert.equal(roleFor("parent@example.com"), "parent");
  for (const bad of [
    "someone@else.com",
    "kid@example.com.evil.com",
    "evil.com/kid@example.com",
    "",
    null,
    undefined,
  ]) assert.equal(roleFor(bad as string), null, `should reject: ${bad}`);
});

test("matching is case and whitespace insensitive", () => {
  assert.equal(roleFor("  KID@Example.COM "), "kid");
  assert.equal(roleFor("Parent@Example.COM"), "parent");
});

// An unset env var must not turn an empty email into a valid role.
test("unset env vars never grant a role", () => {
  const k = process.env.KID_EMAIL, p = process.env.PARENT_EMAIL;
  delete process.env.KID_EMAIL; delete process.env.PARENT_EMAIL;
  for (const v of ["", "   ", "anyone@example.com"]) assert.equal(roleFor(v), null);
  process.env.KID_EMAIL = k; process.env.PARENT_EMAIL = p;
});

test("decodeIdToken reads claims and survives junk", () => {
  const claims = { email: "kid@example.com", email_verified: true };
  const b64 = Buffer.from(JSON.stringify(claims)).toString("base64url");
  assert.deepEqual(decodeIdToken(`header.${b64}.sig`), claims);
  for (const junk of ["", "no-dots", "a.!!!.c"]) assert.equal(decodeIdToken(junk), null);
});

test("redirect uri matches what Google must be configured with", () => {
  assert.equal(redirectUri("https://app.example.com"),
               "https://app.example.com/api/auth/callback/google");
});

// Regression: req.url presented as http behind Cloudflare, which would make
// redirect_uri mismatch what Google has registered and fail every sign-in.
test("originFrom forces https off localhost and honours APP_ORIGIN", async () => {
  const { originFrom } = await import("../lib/oauth.ts");
  assert.equal(originFrom("http://app.example.com/api/auth/google"), "https://app.example.com");
  assert.equal(originFrom("https://app.example.com/api/auth/google"), "https://app.example.com");
  assert.equal(originFrom("http://localhost:3000/api/auth/google"), "http://localhost:3000");
  assert.equal(originFrom("http://127.0.0.1:8789/x"), "http://127.0.0.1:8789");
  process.env.APP_ORIGIN = "https://override.example/";
  assert.equal(originFrom("http://whatever/x"), "https://override.example");
  delete process.env.APP_ORIGIN;
});

test("verifyLogin accepts only the configured accounts", async () => {
  const { verifyLogin } = await import("../lib/users.ts");
  // Fixture values only. Never put a real account's credentials in a test —
  // this file is committed, and the repo is public.
  process.env.KID_USERNAME = "testkid";    process.env.KID_PASSWORD = "fixture-pw";
  process.env.PARENT_USERNAME = "testparent"; process.env.PARENT_PASSWORD = "parent-pw";

  assert.deepEqual(verifyLogin("testkid", "fixture-pw"), { user: "testkid", role: "kid" });
  assert.deepEqual(verifyLogin("  TestKid ", "fixture-pw"), { user: "testkid", role: "kid" });
  assert.deepEqual(verifyLogin("testparent", "parent-pw"), { user: "testparent", role: "parent" });

  // Wrong password, wrong user, crossed pairs, and empties all fail.
  assert.equal(verifyLogin("testkid", "fixture-p"), null);
  assert.equal(verifyLogin("testkid", "FIXTURE-PW"), null);   // password IS case sensitive
  assert.equal(verifyLogin("testkid", "parent-pw"), null);
  assert.equal(verifyLogin("nobody", "fixture-pw"), null);
  assert.equal(verifyLogin("", ""), null);
  assert.equal(verifyLogin("testkid", ""), null);
});

test("an unconfigured account can never be logged into", async () => {
  const { verifyLogin } = await import("../lib/users.ts");
  for (const k of ["KID_USERNAME","KID_PASSWORD","PARENT_USERNAME","PARENT_PASSWORD"]) delete process.env[k];
  for (const [u,p] of [["",""],["testkid","fixture-pw"],["undefined","undefined"]]) {
    assert.equal(verifyLogin(u, p), null, `${u}/${p} must not authenticate`);
  }
});

test("extra kid slots work, and unset ones are never a way in", async () => {
  const { verifyLogin } = await import("../lib/users.ts");
  for (const k of ["KID_USERNAME","KID_PASSWORD","KID2_USERNAME","KID2_PASSWORD",
                   "KID3_USERNAME","KID3_PASSWORD","PARENT_USERNAME","PARENT_PASSWORD"]) delete process.env[k];

  process.env.KID3_USERNAME = "thirdkid"; process.env.KID3_PASSWORD = "pw3";
  assert.deepEqual(verifyLogin("thirdkid", "pw3"), { user: "thirdkid", role: "kid" });
  assert.equal(verifyLogin("thirdkid", "wrong"), null);

  // Slots 1, 2, 4 and 5 are unset — none of them may authenticate anything.
  for (const [u, p] of [["", ""], ["undefined", "undefined"], ["thirdkid", ""]]) {
    assert.equal(verifyLogin(u, p), null, `${u}/${p} must not authenticate`);
  }
});
