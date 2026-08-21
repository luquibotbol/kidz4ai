import { test } from "node:test";
import assert from "node:assert/strict";
import { BLANK, BLANK_KIT, kitContext, validRequest, pendingRequest, recentlyDeclined,
         type Request, type State } from "../lib/state.ts";

const req = (over: Partial<Request> = {}): Request => ({
  id: "r1", what: "an email address he controls",
  why: "the marketplace needs one to list the sticker pack",
  cost: 0, reversible: true,
  workaround: "list it under the Roblox account he already has, and swap later",
  status: "pending", askedAt: "2026-08-19T00:00:00.000Z", ...over,
});

// Rule 1 — a request without a real workaround is rejected, not stored.
test("a request needs a real, non-trivial workaround", () => {
  assert.ok(validRequest(req()));
  assert.equal(validRequest({ ...req(), workaround: "" }), false, "empty rejected");
  assert.equal(validRequest({ ...req(), workaround: "wait" }), false, "trivial rejected");
  assert.equal(validRequest({ ...req(), what: "x" }), false);
  assert.equal(validRequest({ ...req(), cost: -1 }), false);
});

// Rule 2 — one pending at a time.
test("only one request may be pending", () => {
  const s = { ...BLANK, requests: [req()] } as State;
  assert.ok(pendingRequest(s), "a pending one is found and blocks a second");
  const done = { ...BLANK, requests: [req({ status: "approved" })] } as State;
  assert.equal(pendingRequest(done), null);
});

// Rule 4 — a decline is not re-asked within 30 days.
test("a declined thing is not re-asked for 30 days", () => {
  const declined = { ...BLANK, requests: [req({
    status: "declined", answeredAt: "2026-08-18T00:00:00.000Z" })] } as State;
  const now = new Date("2026-08-25T00:00:00Z");
  assert.equal(recentlyDeclined(declined, "an email address he controls", now), true);
  assert.equal(recentlyDeclined(declined, "AN EMAIL ADDRESS HE CONTROLS", now), true, "case insensitive");
  assert.equal(recentlyDeclined(declined, "a domain name", now), false, "different thing is fine");
  const later = new Date("2026-10-01T00:00:00Z");
  assert.equal(recentlyDeclined(declined, "an email address he controls", later), false, "after 30 days");
});

test("kitContext carries the absolutes even when the kit is empty", () => {
  const ctx = kitContext({ ...BLANK, kit: { ...BLANK_KIT } } as State);
  assert.match(ctx, /WHAT HE ACTUALLY HAS/);
  assert.match(ctx, /Never suggest anything requiring him to claim he is 18/);
  assert.match(ctx, /No Claude account/);
  assert.match(ctx, /credit card in his name/);
  assert.match(ctx, /Do not generate a mission that requires anything not on this list/);
});

test("kitContext reflects what the parent declared", () => {
  const s = { ...BLANK, kit: { ...BLANK_KIT, device: "old MacBook Air, shared",
    accounts: ["Roblox", "Canva free"], monthlyBudget: 15, hoursPerWeek: 4,
    canReceiveMail: true, notes: "no Discord" } } as State;
  const ctx = kitContext(s);
  assert.match(ctx, /old MacBook Air, shared/);
  assert.match(ctx, /Roblox, Canva free/);
  assert.match(ctx, /\$15\/mo/);
  assert.match(ctx, /~4 hrs\/week/);
  assert.match(ctx, /Can receive mail: yes/);
  assert.match(ctx, /no Discord/);
});
