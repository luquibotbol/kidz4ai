/* THROWAWAY — probe only. Not part of the app. Delete after the verdict.
   HANDOFF.md step 0.1, generalized for Kids4AI (docs/03-kids4ai-pivot.md).
   Calls the UNMODIFIED mission generator against the live API. */
import { readFileSync } from "node:fs";
import OpenAI from "openai";
import { BLANK, missionContext, calibration, type State, type Ship, type Sale } from "../lib/state.ts";
import { VOICE, MISSION } from "../lib/prompts.ts";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const MODEL = process.env.PROBE_MODEL || "gpt-5.5";
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ship = (title: string, date: string, seenBy: number, days?: number): Ship =>
  ({ id: title.slice(0, 6), title, note: "", seenBy, date, days });
const sale = (product: string, date: string, units: number, price: number, cost: number): Sale =>
  ({ id: product.slice(0, 6), date, product, units, price, cost });
const S = (p: Partial<State>): State => ({ ...BLANK, name: "Kid", ...p });

const CASES: { id: string; label: string; state: State }[] = [
  { id: "01", label: "Cold — plan just written, nothing shipped", state: S({
    plan: "Wants to make and sell things online. Already resells physical stuff. Aiming at something with no upfront cost." }) },
  { id: "02", label: "Shipped 3 fast, all seenBy 0", state: S({
    plan: "Selling digital designs.", lastOutcome: "shipped", lastDays: 2,
    shipped: [ship("Sticker pack", "2026-07-20", 0, 2), ship("Phone wallpaper set", "2026-07-28", 0, 1), ship("Discord emote pack", "2026-08-05", 0, 2)] }) },
  { id: "03", label: "Dropped the last two missions", state: S({
    plan: "Trying to sell digital art.", lastOutcome: "dropped", lastDays: null,
    shipped: [ship("One t-shirt design", "2026-06-11", 3, 6)] }) },
  { id: "04", label: "Shipped one thing that made $40", state: S({
    plan: "Reselling and starting to make his own products.", lastOutcome: "shipped", lastDays: 5,
    shipped: [ship("Custom keychains", "2026-07-30", 22, 5)],
    sales: [sale("keychain", "2026-08-01", 8, 8, 3)] }) },
  { id: "05", label: "Six weeks of sales, no ships", state: S({
    plan: "Buys cheap, sells higher. Wants to keep growing it.",
    sales: [sale("plant", "2026-07-05", 4, 22, 9), sale("plant", "2026-07-19", 6, 20, 8), sale("plant", "2026-08-09", 5, 24, 9)] }) },
  { id: "06", label: "Shipped once, then 20 days silent", state: S({
    plan: "Making digital products.", lastOutcome: "shipped", lastDays: 4,
    shipped: [ship("Roblox t-shirt", "2026-07-27", 9, 4)] }) },
  { id: "07", label: "Plan says Roblox, all money is reselling", state: S({
    plan: "Wants to build Roblox games and sell game passes.", lastOutcome: "shipped", lastDays: 6,
    shipped: [ship("Listed 12 items on eBay", "2026-08-02", 40, 6)],
    sales: [sale("succulent", "2026-07-22", 9, 18, 6), sale("succulent", "2026-08-08", 7, 19, 6)] }) },
  { id: "08", label: "Everything shipped in under 2 days", state: S({
    plan: "Fast small digital products.", lastOutcome: "shipped", lastDays: 1,
    shipped: [ship("Emote pack", "2026-07-18", 14, 1), ship("Icon set", "2026-07-25", 20, 2), ship("Profile banner shop", "2026-08-06", 31, 1)] }) },
  { id: "09", label: "One mission expired at 21 days", state: S({
    plan: "Wants to make a game.", lastOutcome: "dropped", lastDays: 21,
    shipped: [ship("Half-finished obby", "2026-06-30", 2, 21)] }) },
  { id: "10", label: "Very sparse — name only", state: S({ name: "Sam" }) },

  { id: "11", label: "GENERALIZE: Roblox, 400 players joined, $0", state: S({
    plan: "Building Roblox experiences. Wants people to actually play them.", lastOutcome: "shipped", lastDays: 6,
    shipped: [ship("Obby with 9 stages", "2026-07-21", 260, 6), ship("Tycoon prototype", "2026-08-08", 140, 5)] }) },
  { id: "12", label: "GENERALIZE: video kid, 12k views, no money", state: S({
    plan: "Makes short videos about games he plays. Wants a bigger audience.", lastOutcome: "shipped", lastDays: 3,
    shipped: [ship("Minecraft build timelapse", "2026-07-25", 8400, 3), ship("Roblox glitch short", "2026-08-10", 3900, 2)] }) },
  { id: "13", label: "GENERALIZE: Discord bot, 30 servers installed", state: S({
    plan: "Writes small tools for his friends' Discord servers.", lastOutcome: "shipped", lastDays: 4,
    shipped: [ship("Roll-a-die bot", "2026-07-14", 30, 4)] }) },
  { id: "14", label: "GENERALIZE: Minecraft datapacks — no hand-authored knowledge", state: S({
    plan: "Makes Minecraft datapacks and resource packs, posts them on Planet Minecraft.", lastOutcome: "shipped", lastDays: 5,
    shipped: [ship("Custom mob drops datapack", "2026-08-01", 55, 5)] }) }

];

async function run(c: typeof CASES[number]) {
  const body: any = {
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: VOICE + "\n" + MISSION },
      { role: "user", content: missionContext(c.state) },
    ],
  };
  let res;
  try { res = await ai.chat.completions.create({ ...body, temperature: 0.9 }); }
  catch (e: any) {
    if (!/temperature/i.test(e?.message || "")) throw e;
    console.error("!! MODEL REJECTED temperature — the app sets it too. Retrying without.");
    res = await ai.chat.completions.create(body);
  }
  return { ...c, calibration: calibration(c.state), out: JSON.parse(res.choices[0]?.message?.content || "{}") };
}

/* The rotation is driven by how many missions this kid has already been given
   (lib/state.ts, whyShape). The fixtures are all fresh states, so without this
   every case would be handed shape 0 and the probe would "prove" a uniformity
   the real app never produces. Spread them across the cycle instead. */
CASES.forEach((c, i) => { c.state.missionsMade = i; });

const results: any[] = [];
for (let i = 0; i < CASES.length; i += 4) {
  const batch = await Promise.all(CASES.slice(i, i + 4).map(c =>
    run(c).catch(e => ({ ...c, error: String(e?.message || e) }))));
  results.push(...batch);
  process.stderr.write(`… ${results.length}/${CASES.length}\n`);
}

for (const r of results) {
  console.log("\n" + "=".repeat(72));
  console.log(`${r.id}  ${r.label}`);
  console.log(`CALIBRATION FED: ${r.calibration ?? "-"}`);
  if (r.error) { console.log("ERROR: " + r.error); continue; }
  const o = r.out;
  console.log(`\nTITLE : ${o.title}`);
  console.log(`WHY   : ${o.why}`);
  console.log(`STEPS :\n${(o.steps || []).map((s: string, i: number) => `        ${i + 1}. ${s}`).join("\n")}`);
  console.log(`STUCK : ${o.stuck}`);
  console.log(`DONE  : ${o.done}`);
}
