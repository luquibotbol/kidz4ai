/* Probe: does the discovery interview stay short, and does every message
   actually ask something? A 13-year-old tester reported three things — too
   long, the coach
   restates what he said, and he has to keep telling it to continue. All three
   are measurable, so measure them instead of guessing. */
import { readFileSync } from "node:fs";
import OpenAI from "openai";
import { VOICE, DISCOVERY } from "../lib/prompts.ts";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}
const MODEL = process.env.PROBE_MODEL || "gpt-5.5";
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* A deliberately unhelpful 13-year-old. Not modelled on a real kid — the point
   is the low-effort answering style, which is the hard case. */
const KID = `You are roleplaying a 13-year-old boy answering questions in an app.
You are not enthusiastic. You answer in 3-12 words, lowercase, no punctuation
most of the time. You say "idk" or "nothing much" maybe one time in five. You do
NOT volunteer extra detail unless asked something very specific.
Ground truth about you, reveal only when asked directly:
- yesterday: school, then youtube, then minecraft with two friends until late
- you had a maths test yesterday and got an A. You mention this early, proudly,
  because you are pleased with it. It is NOT what you care about though.
- you build redstone contraptions in minecraft, spent about 40 hours on one farm
- you watch a lot of minecraft tutorial videos and one channel about model rockets
- you once tried to sell painted miniatures to classmates, made about 15 dollars
- the last thing that went wrong: a redstone door kept breaking, you rebuilt it
  four times and eventually got it working
Never break character. Never mention these notes.`;

async function say(messages: any[], model = MODEL) {
  const body: any = { model, messages };
  try { return await ai.chat.completions.create(body); }
  catch (e: any) {
    if (!/temperature/i.test(e?.message || "")) throw e;
    console.error("!! temperature rejected — retrying without");
    delete body.temperature;
    return await ai.chat.completions.create(body);
  }
}

const coachLog: { role: "user" | "assistant"; content: string }[] = [];
let plan = "";

for (let turn = 0; turn < 30; turn++) {
  const asked = coachLog.filter(m => m.role === "assistant").length;
  const pace = `\n\nYOU HAVE SENT ${asked} MESSAGE${asked === 1 ? "" : "S"} SO FAR. Budget is 10-14.`
    + (asked >= 9 ? " You are near the end — start closing, and write the plan as soon as you can quote evidence for one bet." : "")
    + (asked >= 13 ? " WRITE THE PLAN NOW, with whatever you have. Say what you are unsure about." : "");

  const r = await say([{ role: "system", content: VOICE + "\n" + DISCOVERY + pace }, ...coachLog]);
  const out = (r.choices[0]?.message?.content || "").trim();
  if (!out) throw new Error("empty coach reply");
  coachLog.push({ role: "assistant", content: out });
  if (out.includes("[[PLAN_COMPLETE]]")) { plan = out; break; }

  const kidTurns = coachLog.map(m => ({ role: m.role === "assistant" ? "user" : "assistant", content: m.content }));
  const k = await say([{ role: "system", content: KID }, ...kidTurns]);
  coachLog.push({ role: "user", content: (k.choices[0]?.message?.content || "ok").trim() });
}

/* ---- measurements ---- */
const coach = coachLog.filter(m => m.role === "assistant");
const body = coach.filter(m => !m.content.includes("[[PLAN_COMPLETE]]"));
const noQuestion = body.filter(m => !m.content.trim().endsWith("?") && !/\?\s*$/.test(m.content));
const BANNED = /\b(good job|well done|nice one|nice,|love that|that'?s awesome|impressive|that'?s great|amazing|a real skill)\b/i;
const praised = body.filter(m => BANNED.test(m.content));
const words = (t: string) => t.trim().split(/\s+/).length;
const longMsgs = body.slice(1).filter(m => words(m.content) > 40);

for (const m of coachLog) {
  const who = m.role === "assistant" ? "COACH" : "kid  ";
  console.log(`${who} | ${m.content.replace(/\n+/g, " ⏎ ").slice(0, 150)}`);
}
console.log("\n" + "=".repeat(60));
console.log(`coach messages           : ${coach.length}   (target 10-14)`);
console.log(`reached the plan         : ${plan ? "yes" : "NO — ran out at 30"}`);
console.log(`messages with no question: ${noQuestion.length}/${body.length}   (target 0)`);
console.log(`messages with praise     : ${praised.length}/${body.length}   (target 0)`);
console.log(`over 40 words            : ${longMsgs.length}/${body.length}`);
if (noQuestion.length) console.log("\nno-question examples:\n" + noQuestion.slice(0, 3).map(m => "  - " + m.content.slice(0, 120)).join("\n"));
if (praised.length) console.log("\npraise examples:\n" + praised.slice(0, 3).map(m => "  - " + m.content.slice(0, 120)).join("\n"));
