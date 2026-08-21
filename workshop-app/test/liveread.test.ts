import { test } from "node:test";
import assert from "node:assert/strict";
import { BLANK, readDirective, readBlock, trend, pushRead, disengaged, phase,
         READ_CAP, type Read, type Signal, type State } from "../lib/state.ts";

const r = (signal: Signal, heat: 0 | 1 | 2 = 0, quote?: string): Read =>
  ({ at: "2026-08-19T00:00:00.000Z", signal, heat, ...(quote ? { quote } : {}) });

// Every row of the spec 03 directive table.
test("directive table — one row at a time", () => {
  const solo = (x: Read) => readDirective(x, [x]);
  assert.match(solo(r("stuck", 0))!, /Give the answer first/);
  assert.match(solo(r("stuck", 1))!, /Give the answer first/);
  assert.match(solo(r("stuck", 2))!, /Stop coaching/);
  assert.match(solo(r("confused", 0))!, /Answer the literal question/);
  assert.match(solo(r("confused", 2))!, /go back one step|Go back one step/);
  assert.match(solo(r("bored", 0))!, /closed question/);
  assert.match(solo(r("bored", 2))!, /Offer to drop this mission/);
  assert.match(solo(r("blocked", 0))!, /Name it exactly/);
  assert.match(solo(r("rolling", 0))!, /Stay out of the way/);
  assert.match(solo(r("money", 0))!, /React to the number/);
  assert.match(solo(r("social", 0))!, /Follow him there briefly/);
  assert.equal(solo(r("none", 0)), null, "none injects nothing");
});

test("3+ stuck in the last 5 overrides the per-message directive", () => {
  const recent = [r("stuck"), r("stuck"), r("confused"), r("stuck"), r("rolling")];
  assert.match(readDirective(r("stuck", 0), recent)!, /too big and offer to swap/);
  // even at heat 2, the run wins over the single-message directive
  assert.match(readDirective(r("stuck", 2), recent)!, /too big and offer to swap/);
  // two stuck is not a run
  const two = [r("stuck"), r("confused"), r("stuck"), r("rolling"), r("rolling")];
  assert.match(readDirective(r("stuck", 0), two)!, /Give the answer first/);
});

test("the injected block never invites commentary, and carries the pattern", () => {
  const b = readBlock(r("stuck", 2, "this is actually impossible"), [r("stuck", 2), r("rolling")]);
  assert.match(b, /LIVE READ/);
  assert.match(b, /Stop coaching/);
  assert.match(b, /Recent pattern: stuck, rolling/);
  assert.match(b, /Never mention this block/);
  assert.equal(readBlock(r("none"), [r("none")]), "", "none injects no block at all");
});

test("reads are FIFO capped at 50", () => {
  let s: State = { ...BLANK };
  for (let i = 0; i < 60; i++) s = { ...s, reads: pushRead(s, r("rolling")) };
  assert.equal(s.reads.length, READ_CAP);
});

test("trend returns the last five, newest first", () => {
  let s: State = { ...BLANK };
  for (const sig of ["stuck","confused","bored","rolling","money","social"] as Signal[]) {
    s = { ...s, reads: pushRead(s, r(sig)) };
  }
  assert.deepEqual(trend(s).map(x => x.signal), ["social","money","rolling","bored","confused"]);
});

test("4+ bored/none in five sets STUCK before the day counter would", () => {
  const today = new Date().toISOString().slice(0, 10);
  const base: State = { ...BLANK, plan: "p", discoveryDone: true,
    mission: { title: "m", why: "", steps: [{ text: "s" }], stuck: "Day 2 x", done: "d", startedAt: today } };
  assert.equal(phase(base), "ACTIVE");

  let s = { ...base };
  for (const sig of ["bored","none","bored","rolling","bored"] as Signal[]) s = { ...s, reads: pushRead(s, r(sig)) };
  assert.equal(disengaged(s), true);
  assert.equal(phase(s), "STUCK", "disengagement beats the five-day counter");

  // Three is not enough.
  let t = { ...base };
  for (const sig of ["bored","rolling","bored","rolling","bored"] as Signal[]) t = { ...t, reads: pushRead(t, r(sig)) };
  assert.equal(phase(t), "ACTIVE");
});
