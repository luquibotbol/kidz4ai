import { test } from "node:test";
import assert from "node:assert/strict";

/* Spec 08 acceptance tests 1-3: the provider switch and the moderation fallback.
   Each import gets a unique query so the module re-evaluates with fresh env. */
let n = 0;
const load = async (env: Record<string, string | undefined>) => {
  for (const k of ["AI_PROVIDER", "OPENAI_API_KEY", "OPENAI_BASE_URL", "MODERATION_API_KEY", "OPENAI_MODEL"]) delete process.env[k];
  Object.entries(env).forEach(([k, v]) => { if (v !== undefined) process.env[k] = v; });
  return await import(`../lib/openai.ts?n=${n++}`);
};

test("1. gemini points at the compatibility endpoint; openai does not override", async () => {
  const gem = await load({ AI_PROVIDER: "gemini", OPENAI_API_KEY: "k" });
  assert.equal(gem.client().baseURL, "https://generativelanguage.googleapis.com/v1beta/openai/");

  const oai = await load({ AI_PROVIDER: "openai", OPENAI_API_KEY: "k" });
  assert.equal(oai.client().baseURL, "https://api.openai.com/v1");   // SDK default
});

test("2. OPENAI_BASE_URL overrides both, so the test mock still intercepts", async () => {
  for (const provider of ["openai", "gemini"]) {
    const m = await load({ AI_PROVIDER: provider, OPENAI_API_KEY: "k", OPENAI_BASE_URL: "http://localhost:3200" });
    assert.equal(m.client().baseURL, "http://localhost:3200", `provider ${provider}`);
  }
});

test("3. moderator() uses MODERATION_API_KEY on gemini, and returns null unset", async () => {
  const withKey = await load({ AI_PROVIDER: "gemini", OPENAI_API_KEY: "k", MODERATION_API_KEY: "mod" });
  assert.notEqual(withKey.moderator(), null);

  // Gemini has no /moderations route, so without the dedicated key there is no
  // moderator at all. It must return null rather than throw — a missing filter
  // is a deployment bug, not a runtime crash for the kid.
  const without = await load({ AI_PROVIDER: "gemini", OPENAI_API_KEY: "k" });
  assert.equal(without.moderator(), null);

  const onOpenAI = await load({ AI_PROVIDER: "openai", OPENAI_API_KEY: "k" });
  assert.notEqual(onOpenAI.moderator(), null, "openai falls back to its own key");
});

test("temp() still omits temperature on gpt-5", async () => {
  const m = await load({ AI_PROVIDER: "openai", OPENAI_API_KEY: "k" });
  assert.deepEqual(m.temp(0.9), {});
});
