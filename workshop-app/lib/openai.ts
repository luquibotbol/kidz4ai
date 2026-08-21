import OpenAI from "openai";

/* ------------------------------------------------------------------
   Provider layer.

   Generation runs through whichever provider AI_PROVIDER names.
   Gemini speaks OpenAI's wire format at its compatibility endpoint, so
   the same SDK and the same call sites work for both — only the base
   URL, the key and the model name change.

   Moderation is deliberately NOT part of this switch. Gemini's
   compatibility layer has no /moderations route, and spec 09 requires a
   content filter. OpenAI's moderation endpoint is free and standalone,
   so we keep a key for it regardless of who generates.

   Swapping providers is two env vars. Keep it that way — if a provider
   pulls the key, failover should be a redeploy, not a rewrite.
------------------------------------------------------------------- */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";

// Default is OpenAI: Lucas has credits, and OpenAI publishes explicit
// guidance permitting minor-facing apps. Gemini works and is one env var
// away, but its API terms restrict minor-directed services — see
// docs/01-decisions.md, D-011.
type Provider = "openai" | "gemini";
const PROVIDER = (process.env.AI_PROVIDER || "openai") as Provider;

const DEFAULTS: Record<Provider, { model: string; cheap: string }> = {
  openai: { model: "gpt-5.5", cheap: "gpt-5-mini" },
  gemini: { model: "gemini-3.6-flash", cheap: "gemini-3.1-flash-lite" },
};

export const MODEL = process.env.OPENAI_MODEL || DEFAULTS[PROVIDER].model;
export const MODEL_CHEAP = process.env.OPENAI_MODEL_CHEAP || DEFAULTS[PROVIDER].cheap;

/** Generation client — coach, mission, discovery, live read, facts. */
export function client() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set on the server.");

  // OPENAI_BASE_URL wins when set, so tests can still point at mock-openai.js
  // and so a proxy stays possible. Otherwise the provider decides.
  const baseURL =
    process.env.OPENAI_BASE_URL ||
    (PROVIDER === "gemini" ? GEMINI_BASE : undefined);

  return new OpenAI({ apiKey, baseURL });
}

/**
 * Moderation client — always OpenAI, always the real endpoint.
 * Returns null when no key is configured; callers must treat a null
 * moderator as "allow" rather than crashing. A missing filter is a
 * deployment bug, not a runtime failure mode for him.
 */
export function moderator() {
  const apiKey = process.env.MODERATION_API_KEY || (PROVIDER === "openai" ? process.env.OPENAI_API_KEY : null);
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL || undefined });
}

/**
 * gpt-5.x rejects any `temperature` other than the default and returns a 400.
 * Older OpenAI models and Gemini accept it. Centralised here so flipping
 * AI_PROVIDER or the model can't reintroduce the bug at a call site.
 *
 * Spread into the request: `...temp(0.9)`. gpt-5's default is 1.0, which is
 * higher than anything we asked for, so dropping it loses no variety.
 */
export function temp(v: number, model: string = MODEL): { temperature?: number } {
  return /^gpt-5/.test(model) ? {} : { temperature: v };
}

/**
 * gpt-5 models spend tokens on reasoning before emitting anything, so a small
 * max_completion_tokens can be consumed entirely by reasoning and return EMPTY
 * content. For a classifier that wants one tiny JSON object, ask for minimal
 * reasoning explicitly.
 */
export function fast(model: string = MODEL): { reasoning_effort?: "minimal" } {
  return /^gpt-5/.test(model) ? { reasoning_effort: "minimal" } : {};
}

export const PROVIDER_NAME = PROVIDER;
