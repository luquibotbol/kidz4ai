"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readState, writeState } from "@/lib/db";
import { signIn, signOut, session } from "@/lib/auth";
import { client, MODEL, MODEL_CHEAP, temp, fast } from "@/lib/openai";
import { notifyParent } from "@/lib/notify";
import { VOICE, MISSION, FACTS, TONE_LINE, TOOL, PROMPTS } from "@/lib/prompts";
import { identifiers } from "@/lib/expr";
import {
  markActive, missionContext, uid, daysBetween,
  pruneFacts, newMoments, nextTease, validRequest, pendingRequest, recentlyDeclined, dueSignals, profileContext, TOOL_CAP, DECK_CAP,
  type State, type Mission, type Fact, type Tone, type Kit,
  type Tool, type ToolInput, type ToolOutput, type PromptCard, type Moment,
} from "@/lib/state";

/** Every mutation runs as a specific user, and writes only that user's row. */
async function guard(): Promise<{ user: string; state: State }> {
  const who = await session();
  if (!who) redirect("/login");
  return { user: who.user, state: await readState(who.user) };
}
async function commit(user: string, s: State) {
  await writeState(user, markActive(s));
  revalidatePath("/");
}

/* Spec 12: commit, then work out whether anything unexpected just became true.
   Recording the key means it can never fire twice. Returns the lines so the UI
   can show them once, right now — never a list he can go and look at. */
async function commitAndMark(user: string, prev: State, next: State): Promise<Moment[]> {
  const fired = newMoments(prev, next);
  await commit(user, fired.length
    ? { ...next, moments: [...next.moments, ...fired.map(m => m.key)] }
    : next);
  return fired;
}
const today = () => new Date().toISOString().slice(0, 10);

/* ---------------- auth ---------------- */
export async function login(_prev: unknown, fd: FormData) {
  const role = await signIn(String(fd.get("username") || ""), String(fd.get("password") || ""));
  // One message for both cases — never reveal which half was wrong.
  if (!role) return { error: "That username and password don't match." };
  redirect(role === "parent" ? "/parent" : "/");
}
export async function logout() { await signOut(); redirect("/login"); }

/* ---------------- name ---------------- */
export async function setName(name: string) {
  const { user, state: s } = await guard();
  await commit(user, { ...s, name: name.trim().slice(0, 40), nameAskedAt: new Date().toISOString() });
}

/** He closed the name prompt without answering. Don't ask again — the "set your
    name" link stays on the header if he changes his mind. */
export async function dismissNamePrompt() {
  const { user, state: s } = await guard();
  if (s.nameAskedAt) return;
  await commit(user, { ...s, nameAskedAt: new Date().toISOString() });
}

/* ---------------- mission ---------------- */
export async function generateMission() {
  const { user, state: s } = await guard();
  const res = await client().chat.completions.create({
    model: MODEL,
    ...temp(0.9),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: VOICE + "\n" + MISSION + (TONE_LINE[s.tone] ? "\n\n" + TONE_LINE[s.tone] : "") },
      { role: "user", content: missionContext(s) },
    ],
  });
  const raw = res.choices[0]?.message?.content || "{}";
  let j: any;
  try { j = JSON.parse(raw); } catch { throw new Error("The model returned something unusable. Try again."); }
  if (!j.title || !Array.isArray(j.steps) || !j.steps.length) {
    throw new Error("The model returned something unusable. Try again.");
  }
  const ex = j.expects || {};
  const mission: Mission = {
    title: String(j.title).slice(0, 80),
    why: String(j.why || ""),
    // Accept both shapes: the model should return objects, but a string is
    // still a valid step with no prompt attached.
    steps: j.steps.slice(0, 6).map((x: any) =>
      typeof x === "string"
        ? { text: x }
        : { text: String(x?.text ?? ""), ...(x?.prompt ? { prompt: String(x.prompt) } : {}) },
    ).filter((x: any) => x.text),
    stuck: String(j.stuck || ""),
    done: String(j.done || ""),
    ...(Array.isArray(j.needs) && j.needs.length
      ? { needs: j.needs.slice(0, 6).map((x: unknown) => String(x).slice(0, 40)).filter(Boolean) }
      : {}),
    ...(ex.byWhen || ex.odds ? {
      expects: {
        byWhen: String(ex.byWhen || ""), odds: String(ex.odds || ""),
        hardDay: String(ex.hardDay || ""), ifItStalls: String(ex.ifItStalls || ""),
      },
    } : {}),
    startedAt: today(),
  };

  /* Spec 04 rules, enforced in code rather than trusted to the prompt:
     a request needs a real workaround, only one may be pending, and a declined
     thing is not re-asked within 30 days. A missing request beats a bad one. */
  let requests = s.requests;
  const reqRaw = j.request as any;
  if (reqRaw && typeof reqRaw === "object") {
    const candidate = {
      what: String(reqRaw.what || ""), why: String(reqRaw.why || ""),
      cost: Number(reqRaw.cost) || 0, reversible: reqRaw.reversible !== false,
      workaround: String(reqRaw.workaround || ""),
    };
    if (validRequest(candidate) && !pendingRequest(s) && !recentlyDeclined(s, candidate.what)) {
      requests = [...s.requests, {
        ...candidate, id: uid(), status: "pending" as const, askedAt: new Date().toISOString(),
      }];
    } else {
      console.error("[spec04] request rejected:", !validRequest(candidate) ? "invalid/no workaround"
        : pendingRequest(s) ? "one already pending" : "declined within 30 days");
    }
  }

  // Advances the why-shape rotation. Counts missions GENERATED, not shipped,
  // so dropping one still moves the shape on — otherwise a kid who drops twice
  // gets the same opening sentence three times running.
  await commit(user, {
    ...s, mission, stepsDone: [], requests,
    missionsMade: (s.missionsMade || 0) + 1,
  });
}

export async function toggleStep(i: number) {
  const { user, state: s } = await guard();
  const done = s.stepsDone.includes(i)
    ? s.stepsDone.filter(x => x !== i)
    : [...s.stepsDone, i];
  await commit(user, { ...s, stepsDone: done });
}

export async function dropMission() {
  const { user, state: s } = await guard();
  await commit(user, { ...s, mission: null, stepsDone: [], lastOutcome: "dropped", lastDays: null });
  await extractFacts("drop");   // why he drops things is durable; the drop isn't
}

export async function shipIt(title: string, note: string, seenBy: number) {
  const { user, state: s } = await guard();
  const days = s.mission ? daysBetween(s.mission.startedAt, today()) : 0;
  const ship = {
    id: uid(), title: title.trim().slice(0, 120), note: note.trim().slice(0, 500),
    seenBy: Math.max(0, Math.floor(seenBy) || 0), date: today(),
    missionTitle: s.mission?.title, days,
  };
  const after: State = {
    ...s, shipped: [...s.shipped, ship],
    mission: null, stepsDone: [], lastOutcome: "shipped" as const, lastDays: days,
  };
  const moments = await commitAndMark(user, s, after);
  await extractFacts("ship");
  const tease = nextTease(after);
  await notifyParent(
    `${s.name || "He"} shipped: ${ship.title}`,
    `${days} day${days === 1 ? "" : "s"}. ${ship.seenBy} ${ship.seenBy === 1 ? "person" : "people"} outside the family saw it.` +
    (ship.note ? `\n\nHe wrote: ${ship.note}` : "") +
    `\n\nNothing needed from you. This is the good state.`,
  );
  return { title: ship.title, made: after.shipped.length, seenBy: ship.seenBy, days, moments, tease };
}

export async function updateSeen(id: string, seenBy: number) {
  const { user, state: s } = await guard();
  return updateSeenInner(user, s, id, seenBy);
}

async function updateSeenInner(user: string, s: State, id: string, seenBy: number) {
  const next = {
    ...s,
    shipped: s.shipped.map(x => x.id === id ? { ...x, seenBy: Math.max(0, Math.floor(seenBy) || 0) } : x),
  };
  return commitAndMark(user, s, next);
}

/* ---------------- money ---------------- */
export async function addSale(product: string, units: number, price: number, cost: number) {
  const { user, state: s } = await guard();
  const next = {
    ...s,
    sales: [...s.sales, {
      id: uid(), date: today(), product: product.trim().slice(0, 80),
      units: Math.max(0, units || 0), price: Math.max(0, price || 0), cost: Math.max(0, cost || 0),
    }],
  };
  const moments = await commitAndMark(user, s, next);
  await extractFacts("sale");
  return { moments };
}
export async function addRobux(what: string, inn: number, out: number) {
  const { user, state: s } = await guard();
  await commit(user, {
    ...s,
    robux: [...s.robux, {
      id: uid(), date: today(), what: what.trim().slice(0, 80),
      inn: Math.max(0, inn || 0), out: Math.max(0, out || 0),
    }],
  });
}
export async function removeSale(id: string) {
  const { user, state: s } = await guard();
  await commit(user, { ...s, sales: s.sales.filter(x => x.id !== id) });
}
export async function removeRobux(id: string) {
  const { user, state: s } = await guard();
  await commit(user, { ...s, robux: s.robux.filter(x => x.id !== id) });
}

/* ---------------- discovery reset ---------------- */
export async function restartDiscovery() {
  const { user, state: s } = await guard();
  await commit(user, { ...s, chat: { ...s.chat, discovery: [] }, discoveryDone: false });
}
export async function clearCoach() {
  const { user, state: s } = await guard();
  await commit(user, { ...s, chat: { ...s.chat, coach: [] } });
}

/* ---------------- friction verdict ----------------
   Asked on the day the mission predicted trouble. The answer is the only
   honest measure of whether the generator knows the domain, and it is the
   seed data for the friction library (sub-project 6). */
export async function answerFriction(hit: boolean) {
  const { user, state: s } = await guard();
  if (!s.mission) return;
  const next = { ...s, mission: { ...s.mission, frictionHit: hit } };
  const moments = await commitAndMark(user, s, next);
  return { moments };
}

/* ---------------- spec 09: disclosure + reporting ---------------- */

export async function ackDisclosure() {
  const { user, state: s } = await guard();
  await commit(user, { ...s, disclosureSeenAt: new Date().toISOString() });
}

/** The flag button on every AI message. Stores no message text — only that a
    report happened, plus his own words if he chose to add them. Spec 09 §3. */
export async function reportMessage(reason: string) {
  const { user, state: s } = await guard();
  const flag = {
    id: uid(),
    at: new Date().toISOString(),
    kind: "report" as const,
    reason: reason.trim().slice(0, 200) || undefined,
  };
  // Stored, not emailed — it surfaces on /parent. Still no message text, ever.
  await commit(user, { ...s, flags: [...s.flags, flag] });
}

/* ---------------- send Lucas a note ----------------
   A deliberate message from the kid, in his own words. This is the one thing
   he writes that is MEANT to reach the parent view, which is why it does not
   cut against D-017 — that rule protects the coach conversation, not a note
   he chose to send. */
export async function sendFeedback(kind: "idea" | "broken", text: string) {
  const { user, state: s } = await guard();
  const clean = text.trim().slice(0, 600);
  if (!clean) return;
  const item = { id: uid(), at: new Date().toISOString(), kind, text: clean };
  // Stored, not emailed. CEO's call: he reads these on /parent when he wants,
  // rather than getting a mail per note. The spec-09 safety escalation in
  // app/api/chat/route.ts still emails — that one is not a preference.
  await commit(user, { ...s, feedback: [...s.feedback, item] });
}

export async function markFeedbackSeen(id: string) {
  const { user, state: s } = await guard();
  await commit(user, { ...s, feedback: s.feedback.map(f => f.id === id ? { ...f, seen: true } : f) });
}

/* ---------------- spec 01: the profile ----------------
   Written rarely and to a high bar. Failures are non-fatal — a profile write
   must never block a ship. */

const FACT_KINDS = ["interest", "skill", "constraint", "preference", "context"] as const;

export async function extractFacts(source: "ship" | "drop" | "coach" | "sale") {
  const { user, state: s } = await guard();
  try {
    const known = s.profile.length
      ? s.profile.map(f => `- ${f.text}`).join("\n")
      : "(nothing on file yet)";
    const recent = [
      s.plan ? `PLAN:\n${s.plan}` : "",
      s.shipped.length ? `SHIPPED: ${s.shipped.slice(-4).map(x => `${x.title} (seen by ${x.seenBy})`).join("; ")}` : "",
      s.sales.length ? `SALES: ${s.sales.slice(-4).map(x => `${x.units}x ${x.product} at ${x.price}, cost ${x.cost}`).join("; ")}` : "",
      s.mission ? `CURRENT MISSION: ${s.mission.title}` : "",
      `LAST OUTCOME: ${s.lastOutcome ?? "none"}`,
      `RECENT COACH MESSAGES:\n${s.chat.coach.slice(-8).map(m => `${m.role}: ${m.content}`).join("\n")}`,
    ].filter(Boolean).join("\n\n");

    const res = await client().chat.completions.create({
      model: MODEL_CHEAP,
      ...temp(0.2, MODEL_CHEAP),
      ...fast(MODEL_CHEAP),
      max_completion_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: FACTS },
        { role: "user", content: `FACTS ALREADY ON FILE:\n${known}\n\nRECENT ACTIVITY:\n${recent}` },
      ],
    });
    const raw = res.choices[0]?.message?.content || "";
    if (!raw.trim()) { console.error("[spec01] fact extraction returned empty content"); return; }

    const j = JSON.parse(raw);
    const incoming: Fact[] = (Array.isArray(j?.facts) ? j.facts : []).slice(0, 2)
      .map((f: any) => String(f?.text ?? "").trim())
      .filter(Boolean)
      .filter((text: string) => !s.profile.some(p => p.text.toLowerCase() === text.toLowerCase()))
      .map((text: string, i: number) => ({
        id: uid(),
        text: text.slice(0, 160),
        kind: (FACT_KINDS.includes((j.facts[i]?.kind)) ? j.facts[i].kind : "context") as Fact["kind"],
        source,
        addedAt: today(),
      }));

    if (!incoming.length) return;
    const fresh = await readState(user);   // re-read: the ship may have just written
    await commit(user, { ...fresh, profile: pruneFacts([...fresh.profile, ...incoming]) });
  } catch (e) {
    console.error("[spec01] fact extraction failed, continuing:", (e as Error)?.message);
  }
}

export async function deleteFact(id: string) {
  const { user, state: s } = await guard();
  await commit(user, { ...s, profile: s.profile.filter(f => f.id !== id) });
}

export async function pinFact(id: string) {
  const { user, state: s } = await guard();
  await commit(user, { ...s, profile: s.profile.map(f => f.id === id ? { ...f, pinned: !f.pinned } : f) });
}

export async function addFact(text: string) {
  const { user, state: s } = await guard();
  const clean = text.trim().slice(0, 160);
  if (!clean) return;
  const fact: Fact = { id: uid(), text: clean, kind: "context", source: "manual", addedAt: today(), pinned: true };
  await commit(user, { ...s, profile: pruneFacts([...s.profile, fact]) });
}

/** Spec 06: the tone dial. Stop guessing at how he wants to be spoken to. */
export async function setTone(tone: Tone) {
  const { user, state: s } = await guard();
  if (!["straight", "warm", "detail"].includes(tone)) return;
  await commit(user, { ...s, tone });
}

/* ---------------- spec 04: Kit and Requests ---------------- */

/** The Kit and Requests live on the KID's row — that is whose mission context
    they feed. The parent edits them; the parent's own row is not involved. */
const kidUser = () => (process.env.KID_USERNAME || "").trim().toLowerCase();

export async function saveKit(patch: Partial<Kit>) {
  const who = await session();
  if (who?.role !== "parent") return;   // the Kit is the parent's declaration
  const user = kidUser();
  if (!user) return;
  const s = await readState(user);
  const k = { ...s.kit, ...patch };
  await commit(user, {
    ...s,
    kit: {
      ...k,
      device: String(k.device || "").slice(0, 120),
      accounts: (k.accounts || []).map(a => String(a).slice(0, 60)).slice(0, 12),
      monthlyBudget: Math.max(0, Number(k.monthlyBudget) || 0),
      hoursPerWeek: Math.max(0, Number(k.hoursPerWeek) || 0),
      notes: String(k.notes || "").slice(0, 500),
    },
  });
}

/** Approve or decline. A decline is not a failure — the coach silently routes
    to the workaround and never says "Lucas said no". */
export async function answerRequest(id: string, status: "approved" | "declined", note?: string) {
  const who = await session();
  if (who?.role !== "parent") return;
  const user = kidUser();
  if (!user) return;
  const s = await readState(user);
  await commit(user, {
    ...s,
    requests: s.requests.map(r => r.id === id
      ? { ...r, status, answeredAt: new Date().toISOString(), ...(note?.trim() ? { parentNote: note.trim().slice(0, 200) } : {}) }
      : r),
  });
}

/* ---------------- spec 05: signals ----------------
   Parent email is generous; kid push is hard-capped in code. The asymmetry is
   the design. `sent` keys make every one-shot fire exactly once. */

export async function runParentSignals() {
  const user = kidUser();
  if (!user) return;
  const s = await readState(user);
  const due = dueSignals(s).filter(sig => !s.sent.includes(sig.key));
  if (!due.length) return;
  for (const sig of due) await notifyParent(sig.subject, sig.body);
  const fresh = await readState(user);
  await commit(user, { ...fresh, sent: [...fresh.sent, ...due.map(d => d.key)].slice(-200) });
}

/** His off switch. One tap, no confirmation, no re-ask. Parent email continues
    — Lucas is still the loop. */
export async function setPushOff(off: boolean) {
  const { user, state: s } = await guard();
  await commit(user, { ...s, pushOff: off });
}

/* ---------------- spec 02: generated tool cards ----------------
   Validated before saving, because a malformed spec must break one card and
   not the app. Never triggered by a page load. */

function validateTool(j: any): Tool | null {
  const kinds = ["calc", "checklist", "tracker", "reference"];
  if (!j || !kinds.includes(j.kind)) return null;
  const title = String(j.title || "").trim();
  if (!title || title.length > 40) return null;

  const base = {
    id: uid(), kind: j.kind as Tool["kind"], title,
    why: String(j.why || "").slice(0, 200),
    ...(j.note ? { note: String(j.note).slice(0, 200) } : {}),
    createdAt: today(),
  };

  if (j.kind === "calc") {
    const inputs: ToolInput[] = (Array.isArray(j.inputs) ? j.inputs : []).slice(0, 6)
      .filter((i: any) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(i?.key || "")))
      .map((i: any) => ({
        key: String(i.key), label: String(i.label || i.key).slice(0, 40),
        type: i.type === "text" ? "text" : "number",
        ...(i.default !== undefined ? { default: i.default } : {}),
        ...(i.prefix ? { prefix: String(i.prefix).slice(0, 3) } : {}),
        ...(i.suffix ? { suffix: String(i.suffix).slice(0, 8) } : {}),
      }));
    const keys = new Set(inputs.map(i => i.key));
    const outputs: ToolOutput[] = (Array.isArray(j.outputs) ? j.outputs : []).slice(0, 6)
      .map((o: any) => ({ label: String(o?.label || "").slice(0, 40), expr: String(o?.expr || ""),
                          format: ["money", "percent", "number", "text"].includes(o?.format) ? o.format : "number" }));
    if (!inputs.length || !outputs.length) return null;
    // Every identifier must be one of this tool's own inputs, and every
    // expression must actually parse. Otherwise the card is silently useless.
    for (const o of outputs) {
      const ids = identifiers(o.expr);
      if (!ids) return null;
      if (ids.some(k => !keys.has(k))) return null;
    }
    return { ...base, inputs, outputs };
  }
  if (j.kind === "checklist") {
    const items = (Array.isArray(j.items) ? j.items : []).slice(0, 12)
      .map((x: any) => ({ text: String(x?.text || "").slice(0, 120), done: false }))
      .filter((x: any) => x.text);
    return items.length ? { ...base, items } : null;
  }
  if (j.kind === "tracker") {
    const target = Number(j.target);
    if (!Number.isFinite(target) || target <= 0) return null;
    return { ...base, target, unit: String(j.unit || "").slice(0, 20), current: Number(j.current) || 0 };
  }
  const rows = (Array.isArray(j.rows) ? j.rows : []).slice(0, 12)
    .map((r: any) => ({ k: String(r?.k || "").slice(0, 40), v: String(r?.v || "").slice(0, 80) }))
    .filter((r: any) => r.k);
  return rows.length ? { ...base, rows } : null;
}

export async function makeTool() {
  const { user, state: s } = await guard();
  if (s.tools.length >= TOOL_CAP) return { error: "You've got six already. Delete one first." };

  const ctx = [
    s.mission ? `RIGHT NOW HE IS DOING: ${s.mission.title}\n${s.mission.why}` : "No mission right now.",
    profileContext(s),
    s.sales.length ? `HIS REAL NUMBERS: ${s.sales.slice(-3).map(x => `${x.units}x ${x.product} at $${x.price}, cost $${x.cost}`).join("; ")}` : "",
    s.tools.length ? `TOOLS HE ALREADY HAS (do not duplicate): ${s.tools.map(t => t.title).join("; ")}` : "",
  ].filter(Boolean).join("\n\n");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client().chat.completions.create({
        model: MODEL, ...temp(0.6), response_format: { type: "json_object" },
        messages: [{ role: "system", content: VOICE + "\n" + TOOL }, { role: "user", content: ctx }],
      });
      const tool = validateTool(JSON.parse(res.choices[0]?.message?.content || "{}"));
      if (tool) {
        const fresh = await readState(user);
        await commit(user, { ...fresh, tools: [...fresh.tools, tool] });
        return { ok: true };
      }
      console.error("[spec02] tool spec rejected, attempt", attempt + 1);
    } catch (e) {
      console.error("[spec02] tool generation failed:", (e as Error)?.message);
    }
  }
  return { error: "Couldn't build that one." };
}

export async function deleteTool(id: string) {
  const { user, state: s } = await guard();
  await commit(user, { ...s, tools: s.tools.filter(t => t.id !== id) });
}

export async function setToolValues(id: string, values: Record<string, number | string>) {
  const { user, state: s } = await guard();
  await commit(user, { ...s, tools: s.tools.map(t => t.id === id ? { ...t, values } : t) });
}

export async function toggleToolItem(id: string, index: number) {
  const { user, state: s } = await guard();
  await commit(user, {
    ...s,
    tools: s.tools.map(t => t.id !== id || !t.items ? t
      : { ...t, items: t.items.map((it, i) => i === index ? { ...it, done: !it.done } : it) }),
  });
}

/** The short walkthrough. Shown once, skippable, never repeated. */
export async function ackTour() {
  const { user, state: s } = await guard();
  if (s.tourSeenAt) return;
  await commit(user, { ...s, tourSeenAt: new Date().toISOString() });
}

/* ---------------- personalised prompt cards ----------------
   The Prompts tab was nine hard-coded cards that knew nothing about him.
   These are generated from his plan, profile, ledger and current mission. */

export async function generateDeck() {
  const { user, state: s } = await guard();

  const ctx = [
    s.plan ? `HIS PLAN:\n${s.plan}` : "",
    profileContext(s),
    s.mission ? `RIGHT NOW HE IS BUILDING: ${s.mission.title}\n${s.mission.why}` : "No mission right now.",
    s.mission?.needs?.length ? `TOOLS HE HAS OPEN: ${s.mission.needs.join(", ")}` : "",
    s.shipped.length ? `HE HAS MADE: ${s.shipped.slice(-5).map(x => `${x.title} (seen by ${x.seenBy})`).join("; ")}` : "",
    s.sales.length ? `HIS REAL NUMBERS: ${s.sales.slice(-4).map(x => `${x.units}x ${x.product} at $${x.price}, cost $${x.cost}`).join("; ")}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const res = await client().chat.completions.create({
      model: MODEL, ...temp(0.7), response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VOICE + "\n" + PROMPTS + (TONE_LINE[s.tone] ? "\n\n" + TONE_LINE[s.tone] : "") },
        { role: "user", content: ctx || "You know nothing about him yet. Write general starter cards." },
      ],
    });
    const raw = res.choices[0]?.message?.content || "";
    if (!raw.trim()) { console.error("[deck] empty content"); return { error: "Couldn't write those." }; }

    const j = JSON.parse(raw);
    const cards: PromptCard[] = (Array.isArray(j?.cards) ? j.cards : [])
      .map((c: any) => ({
        tag: String(c?.tag ?? "").trim().slice(0, 24),
        h: String(c?.h ?? "").trim().slice(0, 60),
        b: String(c?.b ?? "").trim().slice(0, 900),
      }))
      .filter((c: PromptCard) => c.tag && c.h && c.b.length > 30)
      .slice(0, DECK_CAP);

    if (!cards.length) { console.error("[deck] nothing usable came back"); return { error: "Couldn't write those." }; }

    const fresh = await readState(user);
    await commit(user, { ...fresh, deck: cards, deckAt: new Date().toISOString() });
    return { ok: true };
  } catch (e) {
    console.error("[deck] generation failed:", (e as Error)?.message);
    return { error: "Couldn't write those." };
  }
}
