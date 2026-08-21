import { NextRequest, NextResponse } from "next/server";
import { emailFromCode, originFrom } from "@/lib/oauth";
import { roleFor, signInAs } from "@/lib/auth";

export const dynamic = "force-dynamic";

const deny = (origin: string, why: string) =>
  NextResponse.redirect(`${origin}/login?error=${why}`);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = originFrom(req.url);

  const code = url.searchParams.get("code");
  if (!code) return deny(origin, "nocode");

  // CSRF: the state we issued must come back intact.
  let saved: { state?: string; verifier?: string } = {};
  try { saved = JSON.parse(req.cookies.get("k4_oauth")?.value || "{}"); } catch { /* malformed */ }
  if (!saved.state || !saved.verifier) return deny(origin, "expired");
  if (url.searchParams.get("state") !== saved.state) return deny(origin, "state");

  const email = await emailFromCode(code, saved.verifier, origin);
  if (!email) return deny(origin, "exchange");

  // Spec 07: an unknown account never gets a session at all — rejected here,
  // not in middleware and not on the page.
  const role = roleFor(email);
  if (!role) {
    console.error("[auth] rejected a non-allowlisted Google account");
    return deny(origin, "notallowed");
  }

  await signInAs(email, role);
  const res = NextResponse.redirect(`${origin}${role === "parent" ? "/parent" : "/"}`);
  res.cookies.delete("k4_oauth");
  return res;
}
