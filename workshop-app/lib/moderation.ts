import { moderator } from "./openai";
import type { Flag } from "./state";

/** Categories that break the coach-privacy rule and reach Lucas. Spec 09 §2. */
const ESCALATE = ["self-harm", "violence"];

export type Verdict = { flagged: boolean; categories: string[]; escalate: boolean };

/**
 * Returns { flagged: false } when no moderator is configured. A missing filter
 * is a deployment bug, not a runtime failure mode for him — so we log loudly
 * and let the message through rather than crashing mid-conversation.
 */
export async function check(text: string): Promise<Verdict> {
  const m = moderator();
  if (!m) {
    console.error("[spec09] MODERATION NOT CONFIGURED — message passed unchecked.");
    return { flagged: false, categories: [], escalate: false };
  }
  if (!text.trim()) return { flagged: false, categories: [], escalate: false };
  try {
    const r = await m.moderations.create({ model: "omni-moderation-latest", input: text });
    const res: any = r.results?.[0];
    if (!res?.flagged) return { flagged: false, categories: [], escalate: false };
    const categories = Object.entries(res.categories || {})
      .filter(([, on]) => on).map(([k]) => k);
    return {
      flagged: true,
      categories,
      escalate: categories.some(c => ESCALATE.some(e => c.startsWith(e))),
    };
  } catch (e) {
    console.error("[spec09] moderation call failed, message passed unchecked:", e);
    return { flagged: false, categories: [], escalate: false };
  }
}

export function toFlag(v: Verdict): Flag {
  return {
    id: Math.random().toString(36).slice(2, 10),
    at: new Date().toISOString(),
    kind: "moderation",
    category: v.categories.join(","),
  };
}

/**
 * Spec 09 §2: never a block screen. Decline the specific thing in VOICE and
 * move on. A 13-year-old who trips a filter by accident shouldn't feel accused.
 */
export const DECLINE = "I'm not going to help with that one. Ask me something else about what you're building.";
