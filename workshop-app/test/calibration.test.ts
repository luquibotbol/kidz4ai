import { test } from "node:test";
import assert from "node:assert/strict";
import { BLANK, sizeLevel, calibration, hasRealHistory, type State, type Ship, type Sale } from "../lib/state.ts";

const ship = (days: number): Ship => ({ id: "x", title: "t", note: "", seenBy: 1, date: "2026-08-01", days });
const sale = (): Sale => ({ id: "s", date: "2026-08-01", product: "p", units: 3, price: 20, cost: 8 });
const S = (p: Partial<State>): State => ({ ...BLANK, ...p });

test("blank state is level 2 and reads as nothing on the board", () => {
  assert.equal(sizeLevel(BLANK), 2);
  assert.match(calibration(BLANK), /NOTHING ON THE BOARD YET/);
});

test("a dropped mission drops two levels, not to the floor", () => {
  assert.equal(sizeLevel(S({ shipped: [ship(1), ship(1)], lastOutcome: "dropped" })), 2);
  assert.equal(sizeLevel(S({ lastOutcome: "dropped" })), 1);
});

test("three fast ships raise the level but clamp at 4", () => {
  assert.equal(sizeLevel(S({ shipped: [ship(1), ship(2), ship(1)] })), 4);
  assert.equal(sizeLevel(S({ shipped: [ship(1), ship(1), ship(1), ship(1), ship(1)] })), 4);
});

test("slow ships pull the level down and clamp at 1", () => {
  assert.equal(sizeLevel(S({ shipped: [ship(14), ship(21), ship(30)] })), 1);
});

test("it does not oscillate: fast run then a drop lands mid-range", () => {
  const hot = S({ shipped: [ship(1), ship(2), ship(1)] });
  assert.equal(sizeLevel(hot), 4);
  assert.equal(sizeLevel({ ...hot, lastOutcome: "dropped" }), 2); // damped, not 1
});

test("only the last three ships count", () => {
  assert.equal(sizeLevel(S({ shipped: [ship(30), ship(30), ship(1), ship(1), ship(1)] })), 4);
});

// Probe 01, case 05 — a real seller with nothing shipped in-app yet.
test("REGRESSION: real sales and no in-app ship is not a beginner", () => {
  const seller = S({ sales: [sale(), sale(), sale()] });
  assert.ok(hasRealHistory(seller));
  const c = calibration(seller);
  assert.doesNotMatch(c, /NOTHING ON THE BOARD YET/);
  assert.match(c, /NOT a beginner/);
  assert.match(c, /costs them nothing to make again/);
});

test("robux-only history also counts as real history", () => {
  const s = S({ robux: [{ id: "r", date: "2026-08-01", what: "pass", inn: 400, out: 0 }] });
  assert.ok(hasRealHistory(s));
  assert.doesNotMatch(calibration(s), /NOTHING ON THE BOARD YET/);
});

test("every level emits exactly one SIZE line", () => {
  for (const s of [BLANK, S({ lastOutcome: "dropped" }), S({ shipped: [ship(1), ship(1), ship(1)] })]) {
    assert.equal((calibration(s).match(/SIZE:/g) || []).length, 1);
  }
});

test("frictionDay pulls the day out of every phrasing the model uses", async () => {
  const { frictionDay, frictionText } = await import("../lib/state.ts");
  for (const [s, d] of [
    ["Around day 2 the pack won't load", 2],
    ["By day 3 the finish pad fires twice", 3],
    ["Day 1 the prompt may show but nothing opens", 1],
    ["Day 2: the finish pad may record many times", 2],
    ["You'll get stuck when publishing", null],
  ] as const) assert.equal(frictionDay(s), d);

  // The UI renders the day as its own numeral, so the text must not repeat it.
  assert.equal(frictionText("Day 2: the finish pad may record many times"),
               "The finish pad may record many times");
  assert.equal(frictionText("Around day 2 the pack won't load"), "The pack won't load");
  assert.equal(frictionText("no day here"), "No day here");
});

// Regression: raising the model default to gpt-5.5 broke every chat call,
// because gpt-5.x rejects any temperature but the default. The probe script
// silently retried without it, so nothing caught it until production.
test("temp() omits temperature on gpt-5.x and keeps it otherwise", async () => {
  const load = async (model: string) => {
    process.env.OPENAI_MODEL = model;
    const mod = await import(`../lib/openai.ts?m=${encodeURIComponent(model)}`);
    return mod.temp(0.9);
  };
  assert.deepEqual(await load("gpt-5.5"), {});
  assert.deepEqual(await load("gpt-5.6-luna"), {});
  assert.deepEqual(await load("gpt-4o"), { temperature: 0.9 });
  delete process.env.OPENAI_MODEL;
});

// Spec 08: steps gained a shape. Old missions stored plain strings and must
// keep working — a kid mid-mission cannot have his steps vanish on deploy.
test("normalizeMission upgrades string steps and preserves prompts", async () => {
  const { normalizeMission } = await import("../lib/state.ts");
  const base = { title: "t", why: "w", stuck: "Day 2 x", done: "d", startedAt: "2026-08-01" };

  const old = normalizeMission({ ...base, steps: ["one", "two"] } as any);
  assert.deepEqual(old!.steps, [{ text: "one" }, { text: "two" }]);

  const nu = normalizeMission({ ...base, steps: [{ text: "a", prompt: "p" }, { text: "b" }] } as any);
  assert.deepEqual(nu!.steps, [{ text: "a", prompt: "p" }, { text: "b" }]);

  // Mixed, and junk entries dropped rather than rendering blank rows.
  const mixed = normalizeMission({ ...base, steps: ["a", { text: "b", prompt: "p" }, { text: "" }, null] } as any);
  assert.deepEqual(mixed!.steps, [{ text: "a" }, { text: "b", prompt: "p" }]);

  assert.equal(normalizeMission(null), null);
});
