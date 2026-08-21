import { timingSafeEqual } from "crypto";
import type { Role } from "./roles";

/* ------------------------------------------------------------------
   Username + password accounts, configured by env.

   Multiple kids are supported (KID_*, KID2_*). Each kid gets their own
   state row — see lib/db.ts. When parents eventually create their own
   kids' accounts, this file is what gets replaced; everything downstream
   already keys off {user, role}.
------------------------------------------------------------------- */

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

type Entry = { user?: string; pass?: string; role: Role };

/* Kid slots are enumerated so adding another account is two secrets and a
   deploy, with no code change. An unset slot is skipped entirely — see
   verifyLogin, where a slot missing either half can never match. */
const KID_SLOTS = ["KID", "KID2", "KID3", "KID4", "KID5"] as const;

function accounts(): Entry[] {
  const kids: Entry[] = KID_SLOTS.map(prefix => ({
    user: process.env[`${prefix}_USERNAME`],
    pass: process.env[`${prefix}_PASSWORD`],
    role: "kid" as const,
  }));
  return [
    ...kids,
    { user: process.env.PARENT_USERNAME, pass: process.env.PARENT_PASSWORD, role: "parent" },
  ];
}

export function verifyLogin(username: string, password: string): { user: string; role: Role } | null {
  const u = (username || "").trim().toLowerCase();
  const p = password || "";
  if (!u || !p) return null;

  for (const a of accounts()) {
    if (!a.user || !a.pass) continue;   // unconfigured accounts never match
    if (sameString(u, a.user.trim().toLowerCase()) && sameString(p, a.pass)) {
      return { user: a.user.trim().toLowerCase(), role: a.role };
    }
  }
  return null;
}
