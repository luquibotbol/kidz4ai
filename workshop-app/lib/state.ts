// ============================================================
// STATE SHAPE + PURE LOGIC (streak, calibration, totals)
// No IO here so it can be unit-tested.
// ============================================================

export type Msg = { role: "user" | "assistant"; content: string };

/** Spec 08: a step may carry a self-contained prompt for his own AI chat.
    Physical steps (mail it, photograph it) have no prompt. */
export type Step = { text: string; prompt?: string };

export type Mission = {
  title: string;
  why: string;
  steps: Step[];
  stuck: string;
  done: string;
  expects?: Expects;      // spec 04 part C
  needs?: string[];       // apps/sites/accounts he must have open
  startedAt: string;      // ISO date
  frictionHit?: boolean;  // did the prediction come true? undefined = not asked yet
};

export type Ship = {
  id: string;
  title: string;
  note: string;
  seenBy: number;      // strangers who saw it. 0 is fine, never a gate.
  date: string;
  missionTitle?: string;
  days?: number;       // days from mission start to ship
};

/** Spec 09. Category and time only — never the message text. */
export type Flag = {
  id: string;
  at: string;                          // ISO datetime
  kind: "moderation" | "report";
  category?: string;                   // moderation category, or "" for a manual report
  reason?: string;                     // only for kind="report" — his own words, given deliberately
};

/** The kid telling the parent something on purpose. His own words, sent deliberately —
    which is why this reaching the parent view does NOT violate D-017. */
export type Feedback = {
  id: string;
  at: string;
  kind: "idea" | "broken";
  text: string;
  seen?: boolean;
};

/* Spec 03 — the live read. Cheap, disposable, immediate. It never stores a
   belief about him; it reads the current message and changes how the coach
   answers in that same turn. Contrast spec 01, whose bar for permanence is
   much higher. */
export type Signal =
  | "stuck" | "confused" | "bored" | "blocked"
  | "rolling" | "money" | "social" | "none";

export type Read = {
  at: string;
  signal: Signal;
  heat: 0 | 1 | 2;
  quote?: string;   // NEVER rendered, and never shown to the parent
};

/* Spec 01 — durable facts. Written rarely (ship / drop / every 6th coach
   message) and to a high bar, because permanence is expensive to get wrong.
   The live read is the opposite: every message, transient, disposable. */
export type Fact = {
  id: string;
  text: string;
  kind: "interest" | "skill" | "constraint" | "preference" | "context";
  source: "ship" | "drop" | "coach" | "sale" | "manual";
  addedAt: string;
  pinned?: boolean;
};

export type Tone = "straight" | "warm" | "detail";

/* Spec 04 Part A — what he ACTUALLY has, declared by the parent. Missions that
   need something he doesn't have are the number one source of dead missions. */
export type Kit = {
  device: string;
  phone: boolean;
  hasEmail: string | null;
  accounts: string[];
  payment: string | null;
  canReceiveMail: boolean;
  printer: string | null;
  monthlyBudget: number;
  hoursPerWeek: number;
  notes: string;
};

export const BLANK_KIT: Kit = {
  device: "", phone: false, hasEmail: null, accounts: [], payment: null,
  canReceiveMail: false, printer: null, monthlyBudget: 0, hoursPerWeek: 0, notes: "",
};

/* Spec 04 Part B — the AI asking the parent for something a mission needs. */
export type Request = {
  id: string;
  what: string;
  why: string;
  cost: number;
  reversible: boolean;
  workaround: string;          // never empty — he must never sit idle
  status: "pending" | "approved" | "declined";
  askedAt: string;
  answeredAt?: string;
  parentNote?: string;
};

/* Spec 02 — generated tool cards. The AI emits a DECLARATIVE spec; fixed,
   tested code renders it. Never React, never anything executable. */
export type ToolInput = {
  key: string; label: string; type: "number" | "text";
  default?: number | string; prefix?: string; suffix?: string;
};
export type ToolOutput = { label: string; expr: string; format: "money" | "percent" | "number" | "text" };

export type Tool = {
  id: string;
  kind: "calc" | "checklist" | "tracker" | "reference";
  title: string;
  why: string;
  inputs?: ToolInput[];
  outputs?: ToolOutput[];
  items?: { text: string; done: boolean }[];
  target?: number; unit?: string; current?: number;
  rows?: { k: string; v: string }[];
  note?: string;
  createdAt: string;
  pinned?: boolean;
  values?: Record<string, number | string>;   // his entries, persisted per tool
};

export const TOOL_CAP = 6;

/* The Prompts tab used to be nine hard-coded cards that knew nothing about him.
   These are generated from what we actually know, and regenerate on demand. */
export type PromptCard = { tag: string; h: string; b: string };
export const DECK_CAP = 6;

/* Spec 05 — the asymmetry IS the design. Generous to the parent, hard-capped
   in code to the kid. */
export type NudgeKind = "unblocked" | "cutoffer" | "answer" | "money";
export type Nudge = { at: string; kind: NudgeKind };

/* Spec 04 Part C — the honest forecast. Shown to the parent AND to him:
   pre-framing difficulty as expected is protective; hiding it is not. */
export type Expects = {
  byWhen: string;
  odds: string;
  hardDay: string;
  ifItStalls: string;
};

export type Sale  = { id: string; date: string; product: string; units: number; price: number; cost: number };
export type Robux = { id: string; date: string; what: string; inn: number; out: number };

export type State = {
  name: string;
  plan: string | null;
  discoveryDone: boolean;
  mission: Mission | null;
  stepsDone: number[];
  lastOutcome: "shipped" | "dropped" | null;
  lastDays: number | null;
  shipped: Ship[];
  sales: Sale[];
  robux: Robux[];
  chat: { discovery: Msg[]; coach: Msg[] };
  activeWeeks: string[];   // ISO week keys with any activity
  forgiven: string[];      // week keys auto-covered after a miss
  flags: Flag[];           // spec 09 — never contains message text
  disclosureSeenAt: string | null;
  feedback: Feedback[];    // things he chose to send Lucas
  reads: Read[];           // spec 03, last 50, FIFO
  profile: Fact[];         // spec 01, capped at 40
  tone: Tone;              // spec 06, the dial he controls
  kit: Kit;                // spec 04 part A, parent-declared
  requests: Request[];     // spec 04 part B
  nudges: Nudge[];         // spec 05, hard-capped
  pushOff: boolean;        // his off switch. Parent email continues regardless
  sent: string[];          // one-shot parent signal keys, so nothing repeats
  tools: Tool[];           // spec 02, capped at 6
  moments: string[];       // spec 12 — which unexpected moments have already fired
  deck: PromptCard[];      // personalised prompt cards
  deckAt: string | null;   // when they were generated, so we can refresh
  nameAskedAt: string | null;  // asked once, never again — even if he skipped it
  lastBridgeError: string | null;  // last thing that came back broken from his own AI
  tourSeenAt: string | null;   // the short walkthrough, shown once
  missionsMade: number;        // spec 12 — rotates the "why" shape, see whyShape()
};

export const BLANK: State = {
  name: "", plan: null, discoveryDone: false,
  mission: null, stepsDone: [], lastOutcome: null, lastDays: null,
  shipped: [], sales: [], robux: [],
  chat: { discovery: [], coach: [] },
  activeWeeks: [], forgiven: [],
  flags: [], disclosureSeenAt: null, feedback: [], nameAskedAt: null, tourSeenAt: null, lastBridgeError: null, reads: [], profile: [], tone: "straight",
  kit: { ...BLANK_KIT }, requests: [], nudges: [], pushOff: false, sent: [], tools: [], moments: [], deck: [], deckAt: null, missionsMade: 0,
};

// ---------- dates ----------
export function weekKey(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;              // Mon=1..Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - day);      // nearest Thursday
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}
export function prevWeek(key: string, back = 1): string {
  const [y, w] = key.split("-W").map(Number);
  const d = new Date(Date.UTC(y, 0, 4));
  d.setUTCDate(d.getUTCDate() + (w - 1 - back) * 7);
  return weekKey(d);
}
export function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

// ---------- the soft streak ----------
// Counts consecutive weeks with activity. A single missed week is auto-forgiven
// AFTER the fact (never pre-allocated). Beyond that it decays by one per missed
// week instead of resetting. It never displays a catastrophic zero.
export function streak(s: State, now: Date = new Date()): { weeks: number; forgivenThis: boolean } {
  const active = new Set(s.activeWeeks);
  const forgiven = new Set(s.forgiven);
  let cur = weekKey(now);
  let count = 0;
  let misses = 0;
  let forgivenThis = false;

  // Current week not yet active doesn't break anything — the week isn't over.
  if (!active.has(cur)) cur = prevWeek(cur);

  for (let i = 0; i < 260; i++) {
    if (active.has(cur)) { count++; misses = 0; }
    else if (forgiven.has(cur)) { count++; misses = 0; forgivenThis = true; }
    else {
      misses++;
      if (misses > 1) break;   // one free miss inside the run
      count = Math.max(0, count - 1);
      forgivenThis = true;
    }
    cur = prevWeek(cur);
  }
  return { weeks: count, forgivenThis };
}

export function markActive(s: State, now: Date = new Date()): State {
  const k = weekKey(now);
  if (s.activeWeeks.includes(k)) return s;
  const activeWeeks = [...s.activeWeeks, k];
  // Auto-forgive exactly one gap immediately behind, applied after the miss.
  const forgiven = [...s.forgiven];
  const gap = prevWeek(k);
  const before = prevWeek(k, 2);
  if (!activeWeeks.includes(gap) && !forgiven.includes(gap) &&
      (activeWeeks.includes(before) || forgiven.includes(before))) {
    forgiven.push(gap);
  }
  return { ...s, activeWeeks, forgiven };
}

// ---------- money ----------
export function totals(s: State) {
  let rev = 0, cogs = 0, units = 0;
  for (const x of s.sales) {
    units += x.units; rev += x.units * x.price; cogs += x.units * x.cost;
  }
  const rbx = s.robux.reduce((a, r) => a + r.inn - r.out, 0);
  const seen = s.shipped.reduce((a, x) => a + (x.seenBy || 0), 0);
  return { rev, cogs, units, profit: rev - cogs, rbx, seen,
           margin: rev > 0 ? (rev - cogs) / rev : 0 };
}

// ---------- kid state machine ----------
export type Phase = "COLD" | "IDLE" | "ACTIVE" | "STUCK" | "DORMANT";

export function phase(s: State, now: Date = new Date()): Phase {
  if (!s.plan && !s.discoveryDone) return "COLD";
  const lastTouch = lastActivity(s);
  const idleDays = lastTouch ? daysBetween(lastTouch, now.toISOString().slice(0, 10)) : 0;
  if (idleDays >= 14) return "DORMANT";
  if (!s.mission) return "IDLE";
  if (s.mission && idleDays >= 5) return "STUCK";
  // Spec 03: disengagement shows up faster than five days of silence.
  // 4+ bored/none in the last 5 reads means he has checked out of the mission.
  if (s.mission && disengaged(s)) return "STUCK";
  return "ACTIVE";
}

/** 4 or more of the last 5 reads are bored/none. */
export function disengaged(s: State): boolean {
  const last5 = s.reads.slice(-5);
  if (last5.length < 5) return false;
  return last5.filter(r => r.signal === "bored" || r.signal === "none").length >= 4;
}

function lastActivity(s: State): string | null {
  const ds = [
    ...s.shipped.map(x => x.date),
    ...s.sales.map(x => x.date),
    ...s.robux.map(x => x.date),
    s.mission?.startedAt,
  ].filter(Boolean) as string[];
  return ds.length ? ds.sort().at(-1)! : null;
}

// ---------- mission calibration ----------
// Deterministic. The model does not get to decide the size.
/**
 * How big should the next mission be?
 *
 * Derived from the last three SHIPS (via their `days`) plus the most recent
 * outcome, not from the single last event. Using three keeps it damped — a
 * one-off fast ship can't ratchet a kid straight to level 4, and one drop
 * can't collapse him to level 1. Clamped both ends.
 *
 * D-005 says code decides size, not the model. Probe 01 showed the old version
 * was also blind to `sales`, so a kid with six weeks of real selling and no
 * in-app ship was told "FIRST MISSION EVER". See docs/03-kids4ai-pivot.md.
 */
export function sizeLevel(s: State): 1 | 2 | 3 | 4 {
  let lvl = 2;
  for (const sh of s.shipped.slice(-3)) {
    if (typeof sh.days !== "number") continue;
    if (sh.days <= 2) lvl += 1;
    else if (sh.days >= 10) lvl -= 1;
  }
  // Clamp the streak effect BEFORE the drop penalty. Otherwise a long fast run
  // banks headroom above the ceiling and a drop only shaves one step off it,
  // which D-005 says is wrong — a drop must produce a clearly smaller mission.
  lvl = Math.max(1, Math.min(4, lvl));
  if (s.lastOutcome === "dropped") lvl -= 2;   // strongest single signal
  return Math.max(1, Math.min(4, lvl)) as 1 | 2 | 3 | 4;
}

/** True when they've done real commerce outside the app, whatever the app has recorded. */
export function hasRealHistory(s: State): boolean {
  return s.shipped.length > 0 || s.sales.length > 0 || s.robux.length > 0;
}

const SIZE_LINE: Record<1 | 2 | 3 | 4, string> = {
  1: "SMALLER THAN FEELS RIGHT. One sitting. Two days at the absolute most.",
  2: "SMALL. Finishable in two to three days of real work.",
  3: "MEDIUM. Four or five days. It can have two moving parts.",
  4: "AMBITIOUS. Up to a week. They are ahead of where we pitched it — give them something with real range.",
};

export function calibration(s: State): string {
  const lvl = sizeLevel(s);
  const bits = [`SIZE: ${SIZE_LINE[lvl]}`];

  if (s.lastOutcome === "dropped") {
    bits.push("LAST ONE WAS DROPPED. The scope was wrong — it is always scope. Change direction as well as size.");
  } else if (s.lastOutcome === "shipped" && s.lastDays !== null && s.lastDays <= 2) {
    bits.push("LAST ONE SHIPPED IN UNDER 2 DAYS. Push into something they have not tried.");
  } else if (s.lastOutcome === "shipped") {
    bits.push("LAST ONE SHIPPED AT A NORMAL PACE. Change the direction — a different channel or a different kind of thing.");
  }

  if (!hasRealHistory(s)) {
    bits.push("NOTHING ON THE BOARD YET. This is the first thing they will ever finish here, so it must end in a real artifact someone outside their family can see.");
  } else if (!s.shipped.length && (s.sales.length > 0 || s.robux.length > 0)) {
    // Probe 01, case 05 — a real seller with nothing shipped in-app yet.
    bits.push("IMPORTANT: they already sell things to real people for real money. They are NOT a beginner. Do not hand them a starter mission about how to price or list something. Assume they can sell. The new part is making something that costs them nothing to make again.");
  }

  return bits.join(" ");
}

/**
 * The friction point must open with a day (see MISSION in lib/prompts.ts).
 * Pull that number out so the UI can ask, on the day, whether it came true.
 * That question is the falsifiability loop — and the raw material for the
 * friction library. Returns null when the model didn't comply.
 */
/** Missions written before spec 08 stored steps as plain strings. Upgrade them
    on read so nothing downstream has to know both shapes. */
export function normalizeMission(m: Mission | null | undefined): Mission | null {
  if (!m) return null;
  const raw = (m.steps || []) as unknown as Array<string | Step>;
  return { ...m, steps: raw.map(x => (typeof x === "string" ? { text: x } : x)).filter(x => x?.text) };
}

export function frictionDay(stuck: string): number | null {
  const m = /\bday\s*(\d{1,2})\b/i.exec(stuck || "");
  if (!m) return null;
  const d = Number(m[1]);
  return d >= 1 && d <= 30 ? d : null;
}

/**
 * The prediction text with its leading day phrase removed, because the UI
 * renders the day as its own numeral. Without this the card reads
 * "DAY 2 / Day 2: the finish pad may record many times".
 */
export function frictionText(stuck: string): string {
  const t = (stuck || "").replace(/^\s*(around|by|on|about)?\s*day\s*\d{1,2}\s*[:,\-\u2014]?\s*/i, "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : stuck;
}

/** True once the predicted day has arrived and nobody has answered yet. */
export function frictionDue(m: Mission | null, now: Date = new Date()): boolean {
  if (!m || m.frictionHit !== undefined) return false;
  const day = frictionDay(m.stuck);
  if (day === null) return false;
  return daysBetween(m.startedAt, now.toISOString().slice(0, 10)) >= day;
}

/* ------------------------------------------------------------------
   Phase 1 — the bridge.

   The model writes each step's prompt when the mission is generated, on day 0.
   By day 2 it is stale: it doesn't know the day, it doesn't carry the friction
   prediction, and it doesn't know what actually broke. Assemble the real prompt
   at the moment he opens his AI, from state. No extra model call.
------------------------------------------------------------------- */
export function bridgePrompt(s: State, stepIndex: number, now: Date = new Date()): string | null {
  const m = s.mission;
  const step = m?.steps?.[stepIndex];
  if (!m || !step?.prompt) return null;

  const day = daysBetween(m.startedAt, now.toISOString().slice(0, 10)) + 1;
  const hardDay = frictionDay(m.stuck);
  const out = [step.prompt];

  if (m.needs?.length) out.push(`I have open: ${m.needs.join(", ")}.`);

  // The app's best asset is knowing what breaks and when. Hand it over so his
  // AI can pre-empt it instead of rediscovering it.
  if (hardDay !== null && m.stuck) {
    out.push(day >= hardDay
      ? `Heads up, this is the part that usually goes wrong: ${frictionText(m.stuck)} If that is what I am hitting, start there.`
      : `Later on this usually goes wrong: ${frictionText(m.stuck)} Don't fix it yet, just don't set me up for it.`);
  }

  if (s.lastBridgeError) {
    out.push(`Last time I tried, this happened: ${s.lastBridgeError.slice(0, 400)}`);
  }

  out.push("Explain as you go and ask me what I see before moving on. Don't paste a wall of code.");
  return out.join("\n\n");
}

/* ------------------------------------------------------------------
   Spec 12 — unexpected recognition.

   Deci: rewards PROMISED in advance measure -0.28 to -0.44 on intrinsic
   motivation, worse in children. The same recognition arriving UNEXPECTED
   measures about +0.01 — no harm. So: never advertised, never listed, never
   repeatable on demand, and each one fires exactly once in a lifetime.

   Every moment is contingent on him actually making something. None of them
   fire for opening the app, for a streak, or for time passing.
------------------------------------------------------------------- */
export type Moment = { key: string; line: string };

const reach = (s: State) => s.shipped.reduce((a, x) => a + (x.seenBy || 0), 0);
const money = (s: State) => totals(s).profit;

export function newMoments(prev: State, next: State): Moment[] {
  const out: Moment[] = [];
  const add = (key: string, line: string) => {
    if (!next.moments.includes(key)) out.push({ key, line });
  };

  if (prev.shipped.length === 0 && next.shipped.length > 0)
    add("first-ship", "That's the first thing you've made that exists outside your head.");

  if (reach(prev) === 0 && reach(next) > 0)
    add("first-stranger", "Someone who isn't family used it. That's the first time that's happened.");

  if (money(prev) <= 0 && money(next) > 0)
    add("first-money", "Someone paid you for something you made. Not a chore, not a gift.");

  // The prediction coming true is the app's credibility landing. Worth marking.
  if (prev.mission?.frictionHit === undefined && next.mission?.frictionHit === true)
    add("called-it", "It went wrong exactly where I said it would. That's the part most people quit at.");

  // Personal best reach, only once there's something to beat.
  if (next.shipped.length > 1) {
    const latest = next.shipped.at(-1);
    const before = next.shipped.slice(0, -1).reduce((a, x) => Math.max(a, x.seenBy || 0), 0);
    if (latest && (latest.seenBy || 0) > before && before > 0)
      add("best-reach", `More people saw that than anything else you've made.`);
  }

  if (prev.shipped.length < 5 && next.shipped.length >= 5)
    add("five-things", "Five things exist now that didn't before you made them.");

  return out;
}

/** What's coming, grounded in what he actually just did. Not a promise of a
    reward — a straight read of how the next mission gets sized. */
export function nextTease(s: State): string {
  const lvl = sizeLevel(s);
  if (s.lastOutcome === "dropped") return "The next one comes out smaller. That was a scope problem, not you.";
  if (s.lastOutcome === "shipped" && s.lastDays !== null && s.lastDays <= 2)
    return `You did that in ${s.lastDays} day${s.lastDays === 1 ? "" : "s"}. The next one gets more ambitious.`;
  if (lvl >= 3) return "The next one has more room in it.";
  return "The next one's waiting when you want it.";
}

export const FACT_CAP = 40;

/** Newest first, but pinned facts always lead — they are what he insisted on. */
export function orderedFacts(profile: Fact[]): Fact[] {
  const pin = profile.filter(f => f.pinned);
  const rest = profile.filter(f => !f.pinned);
  return [...pin.reverse(), ...rest.reverse()];
}

/** Cap at 40 by dropping the OLDEST UNPINNED. Pinned facts are never dropped. */
export function pruneFacts(profile: Fact[]): Fact[] {
  if (profile.length <= FACT_CAP) return profile;
  const pinned = profile.filter(f => f.pinned);
  const unpinned = profile.filter(f => !f.pinned);
  const keep = Math.max(0, FACT_CAP - pinned.length);
  // Keep the newest `keep` unpinned, preserving original order.
  const survivors = new Set(unpinned.slice(-keep));
  return profile.filter(f => f.pinned || survivors.has(f));
}

/** Injected into both the coach and the mission generator. Capped so prompts
    stay small. */
export function profileContext(s: State): string {
  if (!s.profile.length) return "";
  const lines = orderedFacts(s.profile).slice(0, 15).map(f => `- ${f.text}`);
  return `WHAT YOU KNOW ABOUT HIM\n${lines.join("\n")}`;
}

/** Injected into both the mission generator and the coach. Age constraints here
    are absolute — they are the difference between a usable mission and one that
    asks a 13-year-old to lie about his age. */
export function kitContext(s: State): string {
  const k = s.kit;
  const has = [
    k.device && `Device: ${k.device}`,
    `Phone: ${k.phone ? "yes" : "no"}`,
    k.hasEmail ? `Email he controls: ${k.hasEmail}` : "Email he controls: none",
    k.accounts.length ? `Accounts: ${k.accounts.join(", ")}` : "Accounts: none declared",
    `Money: ${k.monthlyBudget > 0 ? `$${k.monthlyBudget}/mo` : "$0/mo"}${k.payment ? `, via ${k.payment}` : ""}`,
    `Can receive mail: ${k.canReceiveMail ? "yes" : "no"}`,
    k.printer && `Printer: ${k.printer}`,
    k.hoursPerWeek > 0 && `Time: ~${k.hoursPerWeek} hrs/week`,
    k.notes && `Notes: ${k.notes}`,
  ].filter(Boolean).join("\n");

  return [
    "WHAT HE ACTUALLY HAS",
    has,
    "",
    "Do not generate a mission that requires anything not on this list.",
    "If the best next move requires something missing, say so and emit a request.",
    "",
    "ABSOLUTE, regardless of anything above:",
    "- Never suggest anything requiring him to claim he is 18 or older.",
    "- No Claude account. It is 18+ with no parental-consent path. ChatGPT and Gemini are the options.",
    "- Never require a credit card in his name, or an account with an age floor above 13.",
  ].join("\n");
}

/** Spec 04: one pending request at a time. */
export function pendingRequest(s: State): Request | null {
  return s.requests.find(r => r.status === "pending") ?? null;
}

/** Rule 4: never re-ask for the same thing within 30 days of a decline. */
export function recentlyDeclined(s: State, what: string, now = new Date()): boolean {
  const norm = what.trim().toLowerCase();
  return s.requests.some(r =>
    r.status === "declined" &&
    r.what.trim().toLowerCase() === norm &&
    daysBetween((r.answeredAt || r.askedAt).slice(0, 10), now.toISOString().slice(0, 10)) < 30);
}

/** Rule 1: a request without a real workaround is rejected, not stored. */
export function validRequest(r: Partial<Request>): boolean {
  const nonTrivial = (v?: string) => !!v && v.trim().length >= 12;
  return nonTrivial(r.what) && nonTrivial(r.why) && nonTrivial(r.workaround)
    && typeof r.cost === "number" && r.cost >= 0;
}

/* ---------- spec 05: the kid-side caps ---------- */

const H = 3600e3, DAY = 24 * H;

/**
 * Every condition must hold. Counting real nudges rather than a flag is
 * deliberate: a flag can be reset by a bug, a list cannot lie about how many
 * times he was actually interrupted.
 */
export function mayNudge(s: State, now: Date = new Date()): boolean {
  if (s.pushOff) return false;                       // 6. he turned them off
  if (phase(s, now) === "DORMANT") return false;     // 5. dormant is terminal

  const t = now.getTime();
  const week = s.nudges.filter(n => t - Date.parse(n.at) < 7 * DAY).length;
  if (week >= 1) return false;                       // 1. max 1 per rolling 7 days
  const quarter = s.nudges.filter(n => t - Date.parse(n.at) < 90 * DAY).length;
  if (quarter >= 6) return false;                    // 2. max 6 per rolling 90 days

  // 3. 08:00-21:00, and never during weekday school hours.
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < 8 || hour >= 21) return false;
  const weekday = now.getDay() >= 1 && now.getDay() <= 5;
  if (weekday && hour >= 8.5 && hour < 15) return false;

  // 4. not within 24h of his last visit — he doesn't need reminding he was here.
  const last = lastActivity(s);
  if (last && t - Date.parse(`${last}T12:00:00Z`) < DAY) return false;

  return true;
}

/** The only four things that may ever be sent to him. Each carries a payload;
    a notification whose only content is that time passed is a nudge, and
    nudges are out. */
export const NUDGE_TEXT: Record<NudgeKind, (arg?: string) => string> = {
  unblocked: (what = "it") => `Lucas set up ${what}. It's ready.`,
  cutoffer:  (step = "the second part") => `I can cut ${step} and you'd still ship. Want that?`,
  answer:    (thing = "the thing you asked about") => `Found ${thing}. It's in the chat.`,
  money:     (total = "") => `That's ${total} total.`,
};

export const READ_CAP = 50;

/** Append a read, FIFO-capped. */
export function pushRead(s: State, r: Read): Read[] {
  return [...s.reads, r].slice(-READ_CAP);
}

/** The last 5 reads, newest first. */
export function trend(s: State): Read[] {
  return [...s.reads].slice(-5).reverse();
}

const D = {
  stuckMild:  "Give the answer first, in one sentence. Explain after. Do not ask a diagnostic question.",
  stuckHot:   "Stop coaching. Offer to cut the mission down, and say which specific step you would delete. Make the smaller version sound like the real version, because it is.",
  stuckLong:  "He has been stuck for a while. Do not answer the question as asked. Say plainly that this mission is too big and offer to swap it. Name a concrete alternative.",
  confMild:   "Answer the literal question. One concept per message. No analogies unless he asks.",
  confHot:    "He is lost. Go back one step and check the thing before the thing he asked about.",
  boredMild:  "Do not ask why. Ask one closed question about what he'd rather be doing.",
  boredHot:   "Offer to drop this mission. No guilt, no \"are you sure\". Boredom is data about the mission, not about him.",
  blocked:    "He needs something he doesn't have. Name it exactly. Then EITHER give the free path around it, OR emit a tool request. Never leave him waiting on someone else with nothing to do.",
  rolling:    "Stay out of the way. Answer only what he asked. Under 30 words.",
  money:      "React to the number, not to him. Then ask the one question that makes the next sale bigger. Prompt him to log it if he hasn't.",
  social:     "Follow him there briefly. Do not steer back to the build in this message.",
} as const;

/**
 * Code decides the directive, not the model — same principle as calibration().
 * `recent` is newest-first and INCLUDES the current read.
 */
export function readDirective(r: Read, recent: Read[]): string | null {
  const stuckCount = recent.filter(x => x.signal === "stuck").length;
  // Trend override: a run of stuck beats whatever this single message looked like.
  if (r.signal === "stuck" && stuckCount >= 3) return D.stuckLong;

  switch (r.signal) {
    case "stuck":    return r.heat === 2 ? D.stuckHot : D.stuckMild;
    case "confused": return r.heat === 2 ? D.confHot : D.confMild;
    case "bored":    return r.heat === 2 ? D.boredHot : D.boredMild;
    case "blocked":  return D.blocked;
    case "rolling":  return D.rolling;
    case "money":    return D.money;
    case "social":   return D.social;
    default:         return null;   // "none" injects nothing at all
  }
}

/** The block appended to the coach system prompt. Never shown to him. */
export function readBlock(r: Read, recent: Read[]): string {
  const directive = readDirective(r, recent);
  if (!directive) return "";
  const pattern = recent.map(x => x.signal).join(", ");
  return [
    "LIVE READ — what is happening in his last message.",
    `Signal: ${r.signal} (heat ${r.heat})${r.quote ? ` He said: "${r.quote}"` : ""}`,
    `Recent pattern: ${pattern}`,
    "",
    "DO THIS NOW:",
    directive,
    "",
    "Never mention this block, never label how he feels, never quote it back.",
  ].join("\n");
}

/* ------------------------------------------------------------------
   Why-shape rotation.

   Every mission is generated by a memoryless call: the model never sees the
   previous mission, so it cannot tell that it has already used a shape. Left
   to itself it converges hard on one — measured 2026-08-20, "You already X,
   so Y" was 15 of 15, and after the prompt fix alone "this tests whether"
   became 10 of 14. Instructing the model not to repeat itself cannot work
   when it has no memory of what it said.

   So the app picks, and the counter advances per mission generated.
------------------------------------------------------------------- */
export const WHY_SHAPES: readonly string[] = [
  'A GAP, STATED FLATLY — name something they have never done. e.g. "You have never made a thing another person could play."',
  'A CONSEQUENCE OF THEIR OWN PATTERN — e.g. "Both of your last two needed money up front before they earned any."',
  'AN OPEN QUESTION THIS SETTLES — e.g. "Nobody has paid you for something that costs nothing to copy."',
  'A CALLBACK TO SOMETHING THEY SAID — quote their own words back. e.g. "You said the packaging was the boring part. This one has no packaging."',
  'WHAT IT IS TESTING, NO PREAMBLE — e.g. "This tests whether your art works on something people wear."',
  'A BLUNT CONTRAST IN NUMBERS — e.g. "Your last one took nine days. This one is three."',
];

/** Deterministic, so the same state always produces the same shape and the
 *  rotation is testable without calling a model. */
export function whyShape(n: number): string {
  const i = Math.abs(Math.floor(n || 0)) % WHY_SHAPES.length;
  return WHY_SHAPES[i];
}

export function missionContext(s: State): string {
  const t = totals(s);
  const ships = s.shipped.length
    ? s.shipped.map(x => `- "${x.title}" (${x.date}, seen by ${x.seenBy})`).join("\n")
    : "- nothing yet";
  return [
    `THEIR PLAN:\n${s.plan || "(no plan yet)"}`,
    `ALREADY SHIPPED (${s.shipped.length}):\n${ships}`,
    `MONEY: ${t.profit.toFixed(2)} profit from ${t.units} items sold. Robux: ${t.rbx}.`,
    `PEOPLE OUTSIDE THE FAMILY WHO HAVE SEEN THEIR WORK: ${t.seen}`,
    `CALIBRATION: ${calibration(s)}`,
    `WHY-SHAPE FOR THIS MISSION (use this one, not your usual): ${whyShape(s.missionsMade)}`,
    kitContext(s),
    profileContext(s),
  ].filter(Boolean).join("\n\n");
}

export function coachContext(s: State): string {
  const bits = [`THEIR NAME: ${s.name}`];
  if (s.plan) bits.push(`THEIR PLAN:\n${s.plan}`);
  if (s.mission) bits.push(
    `CURRENT MISSION: ${s.mission.title}\nDone when: ${s.mission.done}\nExpected sticking point: ${s.mission.stuck}`
  );
  const lastFail = [...s.shipped].reverse().find(x => x.note)?.note;
  if (lastFail) bits.push(`LAST THING THAT WENT WRONG: ${lastFail}`);
  if (s.shipped.length) bits.push(`ALREADY SHIPPED: ${s.shipped.map(x => x.title).join("; ")}`);
  bits.push(kitContext(s));
  const prof = profileContext(s);
  if (prof) bits.push(prof);
  return bits.join("\n\n");
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------
   Spec 05 — parent signals.

   Generous, because he is an adult who opted in and it costs the kid nothing.
   But every email about a PROBLEM ships with the script, because the email is
   itself the trigger for the behaviour we are trying to prevent: a controlling
   check-in measures r = -0.48 against the kid's autonomy.

   Permission to do nothing stays in every one of them. That paragraph is what
   stops a dashboard turning an interested brother into a manager.
------------------------------------------------------------------- */

export type ParentSignal = { key: string; subject: string; body: string };

const DO_NOTHING =
  "If you'd rather do nothing, doing nothing is a real option and often the right one.";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Which one-shot signals are due now. `key` is stable so a signal fires once:
 * callers record it in state.sent.
 */
export function dueSignals(s: State, now: Date = new Date()): ParentSignal[] {
  const out: ParentSignal[] = [];
  const ph = phase(s, now);
  const t = totals(s);
  const name = s.name || "He";

  // Stuck — day 5 on the same mission, once per mission.
  if (ph === "STUCK" && s.mission) {
    const done = s.stepsDone.length, total = s.mission.steps.length;
    out.push({
      key: `stuck:${s.mission.startedAt}:${s.mission.title}`,
      subject: `${name} — stuck on ${s.mission.title.toLowerCase()}`,
      body: [
        `${done} of ${total} steps done. Nothing has moved in a while.`,
        s.mission.stuck ? `The AI predicted this part: ${s.mission.stuck}` : "",
        "",
        "If you want to help:",
        "  Ask him to SHOW you what's broken. \"send me a pic of the error\"",
        "  Do not ask if he's worked on it.",
        "  Do not mention the app.",
        "",
        DO_NOTHING,
      ].filter(Boolean).join("\n"),
    });
  }

  // Dropped two in a row.
  if (s.lastOutcome === "dropped" && droppedTwice(s)) {
    out.push({
      key: `dropped2:${s.shipped.length}:${s.lastOutcome}`,
      subject: `${name} — missions are coming out too big`,
      body: [
        "Two dropped in a row. That is information about the missions, not about him.",
        "I'm shrinking the next one automatically.",
        "",
        "Nothing needs you here. Mentioning it would make it his problem instead of mine.",
      ].join("\n"),
    });
  }

  // A request has been waiting.
  const pending = pendingRequest(s);
  if (pending) {
    const waited = Math.floor((now.getTime() - Date.parse(pending.askedAt)) / 36e5);
    if (waited >= 1) {
      out.push({
        key: `request:${pending.id}:${waited >= 48 ? "48h" : "1h"}`,
        subject: `${name} needs ${pending.what}`,
        body: [
          `${pending.why}`,
          `Cost: ${pending.cost > 0 ? `$${pending.cost.toFixed(2)}` : "free"}.`,
          "",
          `If you say no, he does this instead: ${pending.workaround}`,
          "He is not sitting waiting on you either way.",
        ].join("\n"),
      });
    }
  }

  // Dormant — day 14, once, then never. The one that matters.
  if (ph === "DORMANT") {
    out.push({
      key: "dormant",
      subject: `${name} hasn't opened this in two weeks`,
      body: [
        `${name} hasn't opened this in two weeks. I'm going quiet on my side now —`,
        "no more messages to him, permanently, unless he comes back on his own.",
        "",
        "That's by design. Reactivation pressure is how this becomes a chore.",
        "",
        "If you want to do one thing: don't ask about the app. Ask what he's",
        "selling. If the answer is \"nothing\", that's the real information.",
      ].join("\n"),
    });
  }

  // The weekly note — Sunday. Six lines of English, one number at the end.
  if (now.getDay() === 0) {
    out.push({
      key: `weekly:${iso(now)}`,
      subject: `${name} — this week`,
      body: weeklyNote(s, now),
    });
  }

  return out;
}

function droppedTwice(s: State): boolean {
  // Two drops with no ship since — the ship log is the only durable record.
  return s.lastOutcome === "dropped" && s.shipped.length > 0
    ? daysBetween(s.shipped.at(-1)!.date, iso(new Date())) > 14
    : s.lastOutcome === "dropped" && s.shipped.length === 0;
}

/** No charts, no percentages, no streak. Six lines, then one number. */
export function weeklyNote(s: State, now: Date = new Date()): string {
  const t = totals(s);
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  const since = (d: string) => Date.parse(d) >= weekAgo.getTime();
  const ships = s.shipped.filter(x => since(x.date));
  const sales = s.sales.filter(x => since(x.date));
  const salesTotal = sales.reduce((a, x) => a + x.units * (x.price - x.cost), 0);
  const m = s.mission;
  const day = m ? daysBetween(m.startedAt, iso(now)) + 1 : 0;

  const lines = [
    ships.length
      ? `This week ${s.name || "he"} shipped ${ships.length} thing${ships.length === 1 ? "" : "s"}${sales.length ? ` and logged ${sales.length} sale${sales.length === 1 ? "" : "s"} ($${salesTotal.toFixed(2)})` : ""}.`
      : `This week ${s.name || "he"} shipped nothing${sales.length ? ` and logged ${sales.length} sale${sales.length === 1 ? "" : "s"} ($${salesTotal.toFixed(2)})` : ""}.`,
    m ? `He's on ${m.title.toLowerCase()}, day ${day}, ${s.stepsDone.length} of ${m.steps.length} steps done.`
      : "No mission running right now.",
    m?.expects?.odds ? `I expect it to land ${m.expects.byWhen || "soon"}. ${m.expects.odds}` : "",
    m?.frictionHit !== undefined
      ? `The part I said would break ${m.frictionHit ? "did" : "didn't"}.` : "",
    phase(s, now) === "STUCK" ? "He's stalled on it." : "",
    "Nothing needs you right now.",
    "",
    `Total so far: ${s.shipped.length} things made, ${t.seen} people saw them, $${t.profit.toFixed(2)} in.`,
  ];
  return lines.filter(Boolean).join("\n");
}
