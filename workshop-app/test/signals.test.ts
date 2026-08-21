import { test } from "node:test";
import assert from "node:assert/strict";
import { BLANK, mayNudge, NUDGE_TEXT, dueSignals, weeklyNote,
         type Nudge, type State } from "../lib/state.ts";

// A Wednesday at 16:00 — inside the window, outside school hours.
const OK_TIME = new Date("2026-08-19T16:00:00");

/* Mission started 7 days before OK_TIME: idle enough that rule 4 (not within
   24h of his last visit) doesn't fire, and squarely in STUCK rather than
   DORMANT. Using "today" here made the first test fail, which was rule 4
   working correctly. */
const active = (over: Partial<State> = {}): State => ({
  ...BLANK, plan: "p", discoveryDone: true,
  mission: { title: "Sticker pack", why: "", steps: [{ text: "a" }, { text: "b" }],
             stuck: "Day 2 the print file comes back wrong", done: "d", startedAt: "2026-08-12" },
  ...over,
} as State);
const nudge = (daysAgo: number): Nudge =>
  ({ at: new Date(OK_TIME.getTime() - daysAgo * 864e5).toISOString(), kind: "cutoffer" });

test("1. two nudge-worthy events in a week yield one notification", () => {
  const s = active();
  assert.equal(mayNudge(s, OK_TIME), true, "first is allowed");
  const after = active({ nudges: [nudge(1)] });
  assert.equal(mayNudge(after, OK_TIME), false, "second inside 7 days is refused");
  assert.equal(mayNudge(active({ nudges: [nudge(8)] }), OK_TIME), true, "8 days later is fine");
});

test("2. a nudge at 22:30 is dropped, not queued for morning", () => {
  assert.equal(mayNudge(active(), new Date("2026-08-19T22:30:00")), false);
  assert.equal(mayNudge(active(), new Date("2026-08-19T07:30:00")), false);
});

test("2b. never during weekday school hours, but weekends are fine", () => {
  assert.equal(mayNudge(active(), new Date("2026-08-19T10:00:00")), false, "Wednesday 10am is school");
  assert.equal(mayNudge(active(), new Date("2026-08-22T10:00:00")), true, "Saturday 10am is fine");
});

const dormantState = () => active({ mission: { title: "x", why: "", steps: [{ text: "a" }],
  stuck: "", done: "", startedAt: "2026-01-01" } });

test("3. DORMANT refuses every kind, forever", () => {
  assert.equal(mayNudge(dormantState(), OK_TIME), false);
});

test("4. the off switch stops kid pushes (parent email is a separate path)", () => {
  assert.equal(mayNudge(active({ pushOff: true }), OK_TIME), false);
});

test("5. max 6 in a rolling 90 days", () => {
  const six = [10, 20, 30, 40, 50, 60].map(nudge);
  assert.equal(mayNudge(active({ nudges: six }), OK_TIME), false, "six already sent");
  const aged = [100, 110, 120, 130, 140, 150].map(nudge);
  assert.equal(mayNudge(active({ nudges: aged }), OK_TIME), true, "all outside 90 days");
});

// This must fail loudly if anyone ever adds a "you haven't" later.
const BANNED = [
  /you haven'?t/i, /streak/i, /come back/i, /we miss you/i, /still there/i,
  /don'?t lose/i, /you'?re so close/i, /[😀-🿿]|[🀀-🿿]|[✀-➿]/u, /!/, /\bdays? (since|ago)\b/i,
];
test("6. no kid notification template can contain a banned phrase", () => {
  for (const [kind, fn] of Object.entries(NUDGE_TEXT)) {
    const text = fn("the email");
    for (const rx of BANNED) {
      assert.doesNotMatch(text, rx, `${kind} must not match ${rx}`);
    }
    assert.ok(text.length > 0 && text.length < 120, `${kind} stays short`);
  }
});

test("7. the stuck email carries the script and permission to do nothing", () => {
  const stuck = dueSignals(active(), OK_TIME).find(x => x.key.startsWith("stuck:"));
  assert.ok(stuck, "a stuck signal is due");
  assert.match(stuck!.body, /Ask him to SHOW you what's broken/);
  assert.match(stuck!.body, /Do not ask if he's worked on it/);
  assert.match(stuck!.body, /doing nothing is a real option/);
});

test("8. the weekly note has no percentage and no streak word", () => {
  const note = weeklyNote(active(), new Date("2026-08-23T18:00:00"));
  assert.doesNotMatch(note, /%/);
  assert.doesNotMatch(note, /streak/i);
  assert.match(note, /Total so far:/, "one number, and it is Made / Saw it / money");
  assert.ok(note.split("\n").filter(Boolean).length <= 8);
});

test("9. the dormant email says the app is going quiet permanently", () => {
  const d = dueSignals(dormantState(), OK_TIME).find(x => x.key === "dormant");
  assert.ok(d);
  assert.match(d!.body, /permanently/);
  assert.match(d!.body, /Reactivation pressure/);
  assert.doesNotMatch(d!.body, /come back and|remind him to/i);
});
