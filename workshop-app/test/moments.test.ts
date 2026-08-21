import { test } from "node:test";
import assert from "node:assert/strict";
import { BLANK, newMoments, nextTease, type State, type Ship } from "../lib/state.ts";

const ship = (seenBy: number, id = "a"): Ship =>
  ({ id, title: "thing", note: "", seenBy, date: "2026-08-20", days: 3 });
const S = (o: Partial<State> = {}): State => ({ ...BLANK, ...o } as State);

test("the first ship is marked, and only ever once", () => {
  const fired = newMoments(S(), S({ shipped: [ship(0)] }));
  assert.deepEqual(fired.map(m => m.key), ["first-ship"]);

  // Already recorded -> never again.
  const again = newMoments(S({ shipped: [ship(0)] }), S({ shipped: [ship(0), ship(0, "b")], moments: ["first-ship"] }));
  assert.equal(again.find(m => m.key === "first-ship"), undefined);
});

test("a stranger using it, and money, each fire once and are output-contingent", () => {
  assert.deepEqual(
    newMoments(S({ shipped: [ship(0)] }), S({ shipped: [ship(3)] })).map(m => m.key),
    ["first-stranger"]);

  const sale = { id: "s", date: "2026-08-20", product: "p", units: 1, price: 6, cost: 1 };
  assert.deepEqual(newMoments(S(), S({ sales: [sale] })).map(m => m.key), ["first-money"]);
});

test("the prediction coming true is marked", () => {
  const m = { title: "t", why: "", steps: [{ text: "a" }], stuck: "Day 2 x", done: "d", startedAt: "2026-08-18" };
  const fired = newMoments(S({ mission: m }), S({ mission: { ...m, frictionHit: true } }));
  assert.deepEqual(fired.map(x => x.key), ["called-it"]);

  // Saying it did NOT happen is not a moment.
  assert.equal(newMoments(S({ mission: m }), S({ mission: { ...m, frictionHit: false } })).length, 0);
});

test("personal best reach needs something real to beat", () => {
  // First ever ship with reach is 'first-stranger', not a 'best'.
  const first = newMoments(S(), S({ shipped: [ship(5)] })).map(m => m.key);
  assert.ok(!first.includes("best-reach"));

  const beat = newMoments(
    S({ shipped: [ship(5)], moments: ["first-ship", "first-stranger"] }),
    S({ shipped: [ship(5), ship(9, "b")], moments: ["first-ship", "first-stranger"] }));
  assert.deepEqual(beat.map(m => m.key), ["best-reach"]);

  // Not beating it fires nothing.
  const worse = newMoments(
    S({ shipped: [ship(9)], moments: ["first-ship", "first-stranger"] }),
    S({ shipped: [ship(9), ship(2, "b")], moments: ["first-ship", "first-stranger"] }));
  assert.equal(worse.length, 0);
});

// The rule that keeps this on the right side of the evidence.
test("nothing fires for time passing, opening the app, or activity alone", () => {
  const base = S({ shipped: [ship(3)], moments: ["first-ship", "first-stranger"] });
  assert.equal(newMoments(base, base).length, 0, "an unchanged state produces no moment");

  // Chat activity, reads, tools, a new mission: none of these are output.
  const busy = { ...base, reads: [{ at: "x", signal: "rolling" as const, heat: 0 as const }],
                 chat: { discovery: [], coach: [{ role: "user" as const, content: "hi" }] } };
  assert.equal(newMoments(base, busy).length, 0);
});

test("nextTease reads real state and never promises a reward", () => {
  assert.match(nextTease(S({ lastOutcome: "dropped" })), /smaller/);
  assert.match(nextTease(S({ lastOutcome: "shipped", lastDays: 2 })), /2 days/);
  for (const s of [S(), S({ lastOutcome: "dropped" }), S({ lastOutcome: "shipped", lastDays: 9 })]) {
    const t = nextTease(s);
    assert.doesNotMatch(t, /badge|points|reward|unlock|earn|streak/i);
    assert.doesNotMatch(t, /!/);
  }
});
