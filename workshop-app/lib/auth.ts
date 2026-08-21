import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { verifyLogin } from "./users";

/* ------------------------------------------------------------------
   Session: an HMAC-signed cookie carrying the email and role.

   No database, no adapter, no session table. The cookie IS the session,
   which is why it survives a restart (spec 07 acceptance test 6).
------------------------------------------------------------------- */

const SECRET = process.env.AUTH_SECRET || "dev-only-secret-change-me";
const COOKIE = "ws_session";

export type { Role } from "./roles";
export { roleFor } from "./roles";
import type { Role } from "./roles";

export type Session = { user: string; role: Role };

function sign(v: string) {
  return v + "." + createHmac("sha256", SECRET).update(v).digest("hex").slice(0, 32);
}

function unsign(t: string | undefined): string | null {
  if (!t) return null;
  const i = t.lastIndexOf(".");
  if (i < 0) return null;
  const want = Buffer.from(sign(t.slice(0, i)));
  const got = Buffer.from(t);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return t.slice(0, i);
}

async function setSession(s: Session) {
  const c = await cookies();
  c.set(COOKIE, sign(JSON.stringify(s)), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 365,
  });
}

export async function session(): Promise<Session | null> {
  const c = await cookies();
  const raw = unsign(c.get(COOKIE)?.value);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    return s?.user && (s.role === "kid" || s.role === "parent") ? s : null;
  } catch {
    return null;   // legacy "ok:<ts>" cookies from the password era
  }
}

export async function isAuthed() {
  return (await session()) !== null;
}

/** Used by the password login, and by the OAuth callback if Google is ever enabled. */
export async function signInAs(user: string, role: Role) {
  await setSession({ user, role });
}

/* ---------- username + password ---------- */

export const passwordEnabled = () => process.env.AUTH_MODE !== "google";

export async function signIn(username: string, password: string): Promise<Role | null> {
  if (!passwordEnabled()) return null;
  const hit = verifyLogin(username, password);
  if (!hit) return null;
  await setSession(hit);
  return hit.role;
}

export async function signOut() {
  const c = await cookies();
  c.delete(COOKIE);
}
