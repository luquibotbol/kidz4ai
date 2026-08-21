import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, identifiers } from "../lib/expr.ts";

const ev = (s: string, v: Record<string, number> = {}) => evaluate(s, v);

test("arithmetic and precedence", () => {
  assert.equal(ev("1 + 2"), 3);
  assert.equal(ev("2 + 3 * 4"), 14, "* binds tighter than +");
  assert.equal(ev("(2 + 3) * 4"), 20);
  assert.equal(ev("10 - 2 - 3"), 5, "left associative");
  assert.equal(ev("10 / 2 / 5"), 1);
  assert.equal(ev("2 * (3 + (4 - 1))"), 12, "nested parens");
  assert.equal(ev("1.5 * 2"), 3);
});

test("identifiers resolve from the input values", () => {
  assert.equal(ev("price - cost", { price: 4, cost: 0.9 }), 3.1);
  assert.equal(ev("units * (price - cost)", { units: 3, price: 4, cost: 0.9 }), 9.3);
});

test("the six allowed functions", () => {
  assert.equal(ev("min(3, 5)"), 3);
  assert.equal(ev("max(3, 5)"), 5);
  assert.equal(ev("round(2.6)"), 3);
  assert.equal(ev("ceil(2.1)"), 3);
  assert.equal(ev("floor(2.9)"), 2);
  assert.equal(ev("abs(0 - 4)"), 4);
  assert.equal(ev("max(1, min(10, 4))"), 4, "nested calls");
});

test("unary minus", () => {
  assert.equal(ev("-5 + 8"), 3);
  assert.equal(ev("3 * -2"), -6);
});

test("division by zero is null, never Infinity", () => {
  assert.equal(ev("1 / 0"), null);
  assert.equal(ev("5 / (3 - 3)"), null);
  assert.equal(ev("profit / units", { profit: 10, units: 0 }), null);
});

test("an unknown identifier is null, not a crash", () => {
  assert.equal(ev("price * 2", {}), null);
  assert.equal(ev("price * qty", { price: 2 }), null);
});

test("malformed input is null", () => {
  for (const bad of ["", "   ", "1 +", "* 3", "(1 + 2", "1 + 2)", "1 2", "foo(", "1 ** 2", "@#$"]) {
    assert.equal(ev(bad, { a: 1 }), null, `${JSON.stringify(bad)} must not evaluate`);
  }
});

// The whole point of this file: nothing executable ever runs.
test("no code execution is reachable", () => {
  for (const attack of [
    "constructor",
    "process.exit(1)",
    "globalThis",
    "eval('1+1')",
    "(function(){return 1})()",
    "1; console.log(2)",
    "__proto__",
    "a[0]",
    "`x`",
  ]) {
    const out = ev(attack, { a: 1, constructor: 1 });
    assert.ok(out === null || typeof out === "number",
      `${attack} produced something other than a number or null`);
  }
  // Property access and calls on identifiers simply do not tokenize.
  assert.equal(ev("process.exit(1)"), null);
  assert.equal(ev("eval('1+1')"), null);
});

test("identifiers() lists what a spec depends on, for validation before saving", () => {
  assert.deepEqual(identifiers("units * (price - cost)")!.sort(), ["cost", "price", "units"]);
  assert.deepEqual(identifiers("round(x) + 1"), ["x"], "function names are not identifiers");
  assert.equal(identifiers("@#$"), null, "unparseable returns null, not a partial list");
});
