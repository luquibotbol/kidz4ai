import { test } from "node:test";
import assert from "node:assert/strict";
import { whyShape, WHY_SHAPES, BLANK, missionContext } from "../lib/state.ts";

test("1. six missions in a row never repeat a shape", () => {
  const seen = new Set<string>();
  for (let i = 0; i < WHY_SHAPES.length; i++) seen.add(whyShape(i));
  assert.equal(seen.size, WHY_SHAPES.length);
});

test("2. the rotation wraps rather than running out", () => {
  assert.equal(whyShape(WHY_SHAPES.length), whyShape(0));
  assert.equal(whyShape(WHY_SHAPES.length * 3 + 2), whyShape(2));
});

test("3. it is deterministic — the same count gives the same shape", () => {
  assert.equal(whyShape(4), whyShape(4));
});

test("4. junk counters never throw and never return undefined", () => {
  for (const n of [-1, -7, 0.5, NaN, undefined as any, null as any]) {
    const v = whyShape(n);
    assert.ok(typeof v === "string" && v.length > 0, `bad shape for ${String(n)}`);
  }
});

test("5. the chosen shape actually reaches the model context", () => {
  const s = { ...BLANK, plan: "sells stickers", missionsMade: 2 };
  const ctx = missionContext(s);
  assert.ok(ctx.includes("WHY-SHAPE FOR THIS MISSION"), "shape line missing");
  assert.ok(ctx.includes(whyShape(2)), "wrong shape fed");
  assert.ok(!ctx.includes(whyShape(3)), "fed more than one shape");
});

test("6. a fresh kid starts at the first shape, not undefined", () => {
  assert.ok(missionContext({ ...BLANK, plan: "x" }).includes(whyShape(0)));
});

test("7. no shape suggests the formula it replaced", () => {
  for (const shape of WHY_SHAPES) {
    assert.ok(!/you already .*, so/i.test(shape), `shape reintroduces the formula: ${shape}`);
  }
});
