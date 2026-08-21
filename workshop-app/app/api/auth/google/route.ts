import { NextRequest, NextResponse } from "next/server";
import { authorizeUrl, googleConfigured, originFrom } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 503 });
  }
  const origin = originFrom(req.url);
  const { url, state, verifier } = await authorizeUrl(origin);

  const res = NextResponse.redirect(url);
  // Short-lived, httpOnly. sameSite=lax so it survives Google's redirect back.
  res.cookies.set("k4_oauth", JSON.stringify({ state, verifier }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 600,
  });
  return res;
}
