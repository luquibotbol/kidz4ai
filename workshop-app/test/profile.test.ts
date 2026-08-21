import { test } from "node:test";
import assert from "node:assert/strict";
import { BLANK, pruneFacts, orderedFacts, profileContext, FACT_CAP, type Fact, type State } from "../lib/state.ts";

const f = (n: number, pinned = false): Fact =>
  ({ id: `f${n}`, text: `fact ${n}`, kind: "context", source: "coach", addedAt: "2026-08-01", ...(pinned ? { pinned } : {}) });

test("caps at 40 by dropping the oldest UNPINNED", () => {
  const facts = Array.from({ length: 45 }, (_, i) => f(i));
  const kept = pruneFacts(facts);
  assert.equal(kept.length, FACT_CAP);
  assert.equal(kept[0].id, "f5", "oldest five dropped");
  assert.equal(kept.at(-1)!.id, "f44", "newest kept");
});

test("pinned facts are never dropped, even when they exceed the cap", () => {
  // 5 pinned at the very start (oldest), then 45 unpinned.
  const facts = [...Array.from({ length: 5 }, (_, i) => f(i, true)),
                 ...Array.from({ length: 45 }, (_, i) => f(100 + i))];
  const kept = pruneFacts(facts);
  assert.equal(kept.filter(x => x.pinned).length, 5, "all pinned survive");
  assert.equal(kept.length, FACT_CAP);
  assert.ok(kept.slice(0, 5).every(x => x.pinned));
});

test("everything pinned survives even past the cap", () => {
  const facts = Array.from({ length: 50 }, (_, i) => f(i, true));
  assert.equal(pruneFacts(facts).length, 50, "never silently drop pinned");
});

test("pinned lead, then newest first", () => {
  const facts = [f(1), f(2, true), f(3)];
  assert.deepEqual(orderedFacts(facts).map(x => x.id), ["f2", "f3", "f1"]);
});

test("profileContext injects at most 15 facts, or nothing when empty", () => {
  assert.equal(profileContext({ ...BLANK } as State), "");
  const s = { ...BLANK, profile: Array.from({ length: 30 }, (_, i) => f(i)) } as State;
  const ctx = profileContext(s);
  assert.match(ctx, /WHAT YOU KNOW ABOUT HIM/);
  assert.equal(ctx.split("\n").length - 1, 15, "capped so prompts stay small");
});

// Spec 06: the dial changes warmth and length, never identity. None of the
// three settings may unlock slang, emoji, or praise.
test("no tone setting unlocks emoji, praise or slang", async () => {
  const { TONE_LINE, VOICE } = await import("../lib/prompts.ts");
  assert.equal(TONE_LINE.straight, "", "straight is the default voice, injects nothing");
  for (const k of ["warm", "detail"] as const) {
    const line = TONE_LINE[k];
    assert.ok(line.length > 0);
    assert.doesNotMatch(line, /emoji is (ok|fine|allowed)|use emoji|slang/i);
    assert.match(line, /Still/, "each carries an explicit still-not clause");
  }
  assert.match(TONE_LINE.warm, /no praise before he's done something/);
  assert.match(TONE_LINE.detail, /150 words/);
  // The base voice keeps its absolute bans regardless of dial.
  assert.match(VOICE, /Never use emoji/);
  assert.match(VOICE, /Don't perform it/);
});
