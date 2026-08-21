import { NextRequest, NextResponse } from "next/server";
import { readState, writeState } from "@/lib/db";
import { session } from "@/lib/auth";
import { client, MODEL, MODEL_CHEAP, temp, fast } from "@/lib/openai";
import { VOICE, DISCOVERY, COACH, READ, TONE_LINE } from "@/lib/prompts";
import { markActive, coachContext, pushRead, trend, readBlock,
         type Msg, type Flag, type Read, type Signal } from "@/lib/state";
import { check, toFlag, DECLINE } from "@/lib/moderation";
import { notifyParent } from "@/lib/notify";
import { extractFacts } from "@/app/actions";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const who = await session();
  if (!who) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  // Not a security measure — it keeps the conversation genuinely his.
  if (who.role === "parent") {
    return NextResponse.json({ error: "The coach is the kid's. You can't post here." }, { status: 403 });
  }

  let body: { mode?: string; text?: string; stepIndex?: number; outcome?: "worked" | "broke" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }

  const mode = body.mode === "discovery" ? "discovery" : "coach";
  const text = String(body.text ?? "").slice(0, 4000);

  /* Phase 1 — a return from his own AI. He pastes an error; the coach should
     get a case file. He should not have to re-type what the app already knows. */
  const outcome = body.outcome === "worked" || body.outcome === "broke" ? body.outcome : null;
  const stepIndex = Number.isInteger(body.stepIndex) ? Number(body.stepIndex) : null;

  const s = await readState(who.user);
  const newFlags: Flag[] = [];

  // Context the app already has, prepended server-side rather than typed by him.
  let bridgeNote = "";
  if (outcome && s.mission) {
    const step = stepIndex !== null ? s.mission.steps[stepIndex] : undefined;
    bridgeNote = [
      `[He just came back from his own AI chat.`,
      step ? ` He was on this step: "${step.text}".` : "",
      s.mission.needs?.length ? ` Working in: ${s.mission.needs.join(", ")}.` : "",
      outcome === "worked"
        ? ` It WORKED. Do not re-explain it. Confirm in one line and give the next move only.`
        : ` It BROKE. What follows is what came back. Answer the failure directly, first sentence.`,
      `]`,
    ].join("");
  }

  // Spec 09 §2 — every message he sends, before it reaches the coach.
  if (text) {
    const v = await check(text);
    if (v.flagged) {
      newFlags.push(toFlag(v));
      if (v.escalate) {
        await notifyParent(
          "Kids4AI — a flag you should know about",
          `Category: ${v.categories.join(", ")}\nWhen: ${new Date().toISOString()}\n\nNo transcript is included. That is deliberate — see docs/spec-09-minors.md.`,
        );
      }
      const declined: Msg[] = [...s.chat[mode],
        { role: "user", content: text }, { role: "assistant", content: DECLINE }];
      await writeState(who.user, markActive({
        ...s, chat: { ...s.chat, [mode]: declined }, flags: [...s.flags, ...newFlags],
      }));
      return NextResponse.json({ reply: DECLINE, planComplete: false });
    }
  }

  const log: Msg[] = [...s.chat[mode]];
  // The note is context for the model, not something he said — keep it out of
  // the stored transcript so his history stays his own words.
  if (text) log.push({ role: "user", content: text });

  /* Spec 03 — the live read. Runs BEFORE the coach and shapes the same turn.
     The ~300ms is the feature; do not fire-and-forget it. Failure is
     non-fatal: no block, answer normally, never make him wait on a
     classifier. */
  let read: Read | null = null;
  if (mode === "coach" && text) {
    read = await liveRead(log);
  }
  const reads = read ? pushRead(s, read) : s.reads;
  const block = read ? readBlock(read, [read, ...trend(s)].slice(0, 5)) : "";

  const tone = TONE_LINE[s.tone] || "";
  // The interview ran long partly because the model could not tell where it
  // was, so it could not pace itself. A tester said it felt like more than
  // 25 minutes. Give it the count.
  const asked = log.filter(m => m.role === "assistant").length;
  const pace = mode === "discovery"
    ? `\n\nYOU HAVE SENT ${asked} MESSAGE${asked === 1 ? "" : "S"} SO FAR. Budget is 10-14.`
      + (asked >= 9 ? " You are near the end — start closing, and write the plan as soon as you can quote evidence for one bet." : "")
      + (asked >= 13 ? " WRITE THE PLAN NOW, with whatever you have. Say what you are unsure about." : "")
    : "";

  const sys = (mode === "discovery"
    ? VOICE + "\n" + DISCOVERY + pace
    : VOICE + "\n" + COACH + "\n\n" + coachContext(s)
      + (bridgeNote ? "\n\n" + bridgeNote : "") + (block ? "\n\n" + block : ""))
    + (tone ? "\n\n" + tone : "");

  let out = "";
  try {
    const res = await client().chat.completions.create({
      model: MODEL,
      ...temp(mode === "discovery" ? 0.75 : 0.7),
      messages: [{ role: "system", content: sys }, ...log.map(m => ({ role: m.role, content: m.content }))],
    });
    out = (res.choices[0]?.message?.content || "").trim();
  } catch (e: any) {
    const msg: string = e?.message || "";
    if (e?.status === 401) return NextResponse.json({ error: "The server's OpenAI key was rejected." }, { status: 502 });
    if (e?.status === 429) return NextResponse.json({ error: "Rate limited or out of credit. Wait a minute." }, { status: 502 });
    return NextResponse.json({ error: msg.slice(0, 200) || "OpenAI call failed." }, { status: 502 });
  }
  if (!out) return NextResponse.json({ error: "Empty reply. Try again." }, { status: 502 });

  // Spec 09 §2 — every response, before it renders.
  const outV = await check(out);
  if (outV.flagged) {
    newFlags.push(toFlag(outV));
    console.error("[spec09] model output flagged:", outV.categories.join(","));
    out = DECLINE;
  }

  log.push({ role: "assistant", content: out });

  const finished = mode === "discovery" && out.includes("[[PLAN_COMPLETE]]");
  const next = markActive({
    ...s,
    chat: { ...s.chat, [mode]: log },
    // "It worked" advances the step. "It broke" is remembered so the NEXT
    // prompt he hands his AI already carries the failure.
    ...(outcome === "worked" && stepIndex !== null && !s.stepsDone.includes(stepIndex)
      ? { stepsDone: [...s.stepsDone, stepIndex] } : {}),
    ...(outcome === "broke" ? { lastBridgeError: text.slice(0, 600) } : {}),
    ...(outcome === "worked" ? { lastBridgeError: null } : {}),
    reads,
    flags: newFlags.length ? [...s.flags, ...newFlags] : s.flags,
    ...(finished ? { plan: out.replace("[[PLAN_COMPLETE]]", "").trim(), discoveryDone: true } : {}),
  });
  await writeState(who.user, next);

  /* Spec 01: extract durable facts on every 6th coach message — not every
     message. A model asked for a fact every turn invents one, and invented
     facts are permanent. Fire and forget; a profile write never blocks a reply. */
  if (mode === "coach" && next.chat.coach.length > 0 && next.chat.coach.length % 6 === 0) {
    extractFacts("coach").catch(e => console.error("[spec01] extract failed:", e?.message));
  }

  return NextResponse.json({
    reply: out.replace("[[PLAN_COMPLETE]]", "").trim(),
    planComplete: finished,
  });
}

const SIGNALS = ["stuck","confused","bored","blocked","rolling","money","social","none"];

/** Returns null on any failure or timeout — the coach then answers normally. */
async function liveRead(log: Msg[]): Promise<Read | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2000);
  try {
    const res = await client().chat.completions.create({
      model: MODEL_CHEAP,
      ...temp(0, MODEL_CHEAP),
      ...fast(MODEL_CHEAP),
      // Generous: on a reasoning model this budget covers reasoning too, and a
      // truncated response returns EMPTY content that parses to a silent "none".
      max_completion_tokens: 600,
      response_format: { type: "json_object" },
      // A read of NOW: the last four messages, not the whole relationship.
      messages: [{ role: "system", content: READ }, ...log.slice(-4).map(m => ({ role: m.role, content: m.content }))],
    }, { signal: ctl.signal });

    const raw = res.choices[0]?.message?.content || "";
    if (!raw.trim()) {
      // Never let this fail quietly — a classifier that always says "none"
      // looks exactly like a classifier that is working.
      console.error("[spec03] live read returned EMPTY content — check the token budget");
      return null;
    }
    const j = JSON.parse(raw);
    const signal = (SIGNALS.includes(j?.signal) ? j.signal : "none") as Signal;
    const heat = ([0, 1, 2] as const).includes(j?.heat) ? j.heat : 0;
    const quote = typeof j?.quote === "string" && j.quote.trim()
      ? j.quote.trim().split(/\s+/).slice(0, 10).join(" ") : undefined;
    return { at: new Date().toISOString(), signal, heat, ...(quote ? { quote } : {}) };
  } catch (e) {
    console.error("[spec03] live read skipped:", (e as Error)?.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
