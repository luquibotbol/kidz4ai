import { BLANK, type State } from "./state";

/** Dev-only fixture. Enabled by SEED_DEMO=1, never in production.
    Exists so UI work doesn't require playing through discovery every time.

    Deliberately invented. This repo is public, and a fixture modelled on a
    real kid's history is that kid's history — anonymising the name does not
    anonymise "sold X at school, resold Y online". Keep it fictional. */
export function demoState(): State {
  const iso = (back: number) =>
    new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
  return {
    ...BLANK,
    name: "Sam",
    discoveryDone: true,
    plan: "Fixes up secondhand skateboards and sells them on again. Draws a lot, mostly characters, and has printed a few as stickers. Plays Minecraft most evenings but has never built anything anyone else has played. The gap: every board has to be bought before it can be sold.",
    mission: {
      title: "Publish a Roblox obby",
      why: "Every board costs money before it earns any, so test something digital, where making the second copy costs nothing.",
      steps: [
        { text: "Build one obby with five obstacles and one finish pad.",
          prompt: "I'm 13 and building my first Roblox obby in Roblox Studio. I want five jump obstacles and one finish pad. Walk me through building it one step at a time, and ask me what I see after each step before moving on. Don't paste a wall of code." },
        { text: "Add a sign at the start with your name and the goal.", prompt: "In Roblox Studio, how do I add a sign with text that players can read at the start of my obby? Explain what each part does as we go." },
        { text: "Add a badge that awards when someone finishes.",
          prompt: "I'm 13, making a Roblox obby. I want a badge awarded when a player touches the finish pad. Show me the script, explain what each line does, and tell me where exactly to put it. Ask me what happens after I test it." },
        { text: "Publish it publicly and send the link to five classmates." },
      ],
      stuck: "Day 2: the finish pad may record many times, because Touched events repeat while the player stands on it.",
      done: "Five people outside your family opened the link and one reached the finish.",
      startedAt: iso(3),
    },
    stepsDone: [0, 1],
    lastOutcome: "shipped",
    lastDays: 4,
    shipped: [
      { id: "a1", title: "Refurbished skateboard, sold at the park", note: "", seenBy: 35, date: iso(34), days: 4 },
      { id: "a2", title: "Sticker sheet of my own characters", note: "", seenBy: 26, date: iso(14), days: 3 },
    ],
    sales: [
      { id: "s1", date: iso(34), product: "skateboard", units: 14, price: 6, cost: 1.2 },
      { id: "s2", date: iso(14), product: "sticker sheet", units: 9, price: 21, cost: 7 },
    ],
    robux: [{ id: "r1", date: iso(9), what: "game pass sales", inn: 420, out: 0 }],
    activeWeeks: [], forgiven: [],
  };
}
