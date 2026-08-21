import { getCloudflareContext } from "@opennextjs/cloudflare";
import { BLANK, normalizeMission, type State } from "./state";
import { demoState } from "./seed";

/* ------------------------------------------------------------------
   Storage: Cloudflare D1, one JSON row PER USER.

   Was a single row keyed 'state' — correct while there was exactly one kid,
   wrong the moment a second account exists, because every kid account would
   share (and overwrite) the same data. Keyed by user now: 'state:<user>'.

   D1 has no JSONB, so state is TEXT and parsed here.
------------------------------------------------------------------- */

const g = globalThis as unknown as { __ws_mem?: Record<string, State>; __ws_ready?: boolean };

const keyFor = (user: string) => `state:${user.trim().toLowerCase()}`;

async function db(): Promise<D1Database | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as { DB?: D1Database }).DB ?? null;
  } catch {
    return null;
  }
}

export const hasDb = true;

const seeded = () =>
  process.env.SEED_DEMO === "1" && process.env.NODE_ENV !== "production"
    ? demoState() : structuredClone(BLANK);

async function init(d: D1Database) {
  if (g.__ws_ready) return;
  await d.exec(
    "CREATE TABLE IF NOT EXISTS workshop (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
  );
  g.__ws_ready = true;
}

const parse = (v: string): State => {
  const s = { ...structuredClone(BLANK), ...(JSON.parse(v) as State) };
  // Upgrade pre-spec-08 missions (steps were plain strings) on the way out.
  return { ...s, mission: normalizeMission(s.mission) };
};

export async function readState(user: string): Promise<State> {
  const d = await db();
  if (!d) return ((g.__ws_mem ??= {})[keyFor(user)] ??= seeded());
  await init(d);

  const row = await d.prepare("SELECT v FROM workshop WHERE k = ?").bind(keyFor(user)).first<{ v: string }>();
  if (row?.v) return parse(row.v);

  // One-time inheritance: data written before per-user keys lived under 'state'.
  // Read it, never delete it — it stays as a backstop until this user writes.
  const legacy = await d.prepare("SELECT v FROM workshop WHERE k = 'state'").first<{ v: string }>();
  if (legacy?.v && user.trim().toLowerCase() === (process.env.KID_USERNAME || "").trim().toLowerCase()) {
    return parse(legacy.v);
  }
  return seeded();
}

export async function writeState(user: string, s: State): Promise<void> {
  const d = await db();
  if (!d) { (g.__ws_mem ??= {})[keyFor(user)] = s; return; }
  await init(d);
  await d.prepare(
    `INSERT INTO workshop (k, v, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = datetime('now')`,
  ).bind(keyFor(user), JSON.stringify(s)).run();
}
