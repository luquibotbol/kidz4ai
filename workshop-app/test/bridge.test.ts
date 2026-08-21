import { test } from "node:test";
import assert from "node:assert/strict";
import { BLANK, bridgePrompt, type State } from "../lib/state.ts";

const iso = (back: number) => new Date(Date.now() - back * 864e5).toISOString().slice(0, 10);

const withMission = (over: Partial<State> = {}, startedDaysAgo = 0): State => ({
  ...BLANK,
  mission: {
    title: "Roblox door button", why: "", done: "d",
    stuck: "Day 2 the finish pad fires many times, because Touched repeats",
    needs: ["Roblox Studio", "your own AI chat"],
    steps: [
      { text: "Build the room", prompt: "I'm 13 and building a room in Roblox Studio." },
      { text: "Publish it" },   // physical-ish step, no prompt
    ],
    startedAt: iso(startedDaysAgo),
  },
  ...over,
} as State);

test("returns null when the step has no prompt, or there is no mission", () => {
  assert.equal(bridgePrompt(withMission(), 1), null, "step without a prompt");
  assert.equal(bridgePrompt(BLANK as State, 0), null, "no mission");
  assert.equal(bridgePrompt(withMission(), 9), null, "step out of range");
});

test("carries what he has open, and always asks the AI to explain rather than dump code", () => {
  const p = bridgePrompt(withMission(), 0)!;
  assert.match(p, /I'm 13 and building a room in Roblox Studio\./, "keeps the model's own prompt");
  assert.match(p, /I have open: Roblox Studio, your own AI chat\./);
  assert.match(p, /ask me what I see before moving on/);
  assert.match(p, /Don't paste a wall of code/);
});

test("the friction prediction changes tense once the day arrives", () => {
  const before = bridgePrompt(withMission({}, 0), 0)!;   // day 1, predicted day 2
  assert.match(before, /Later on this usually goes wrong/);
  assert.doesNotMatch(before, /start there/, "not yet actionable");

  const after = bridgePrompt(withMission({}, 3), 0)!;    // day 4, past day 2
  assert.match(after, /this is the part that usually goes wrong/);
  assert.match(after, /If that is what I am hitting, start there/);
});

test("the day phrase is stripped so it doesn't read 'Day 2 ... Day 2'", () => {
  const p = bridgePrompt(withMission({}, 3), 0)!;
  assert.doesNotMatch(p, /Day 2 the finish pad/, "raw prefixed form must not appear");
  assert.match(p, /the finish pad fires many times/i);
});

test("a previous failure is handed over, and cleared state omits it", () => {
  const withErr = bridgePrompt(withMission({ lastBridgeError: "attempt to index nil value 'Humanoid'" }), 0)!;
  assert.match(withErr, /Last time I tried, this happened: attempt to index nil value/);

  const clean = bridgePrompt(withMission(), 0)!;
  assert.doesNotMatch(clean, /Last time I tried/);
});

test("a long pasted error is truncated rather than sent whole", () => {
  const p = bridgePrompt(withMission({ lastBridgeError: "x".repeat(2000) }), 0)!;
  assert.ok(p.length < 1200, `prompt stayed bounded (was ${p.length})`);
});
