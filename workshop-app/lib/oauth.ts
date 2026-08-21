/* ------------------------------------------------------------------
   Google sign-in, authorization-code flow with PKCE.

   Deliberately not a library — one provider, two allowed addresses, and a
   session we already had. See D-034.

   On ID token verification: the token is read straight from Google's token
   endpoint over TLS in a server-to-server call, so its signature does not
   need checking. OpenID Connect Core 3.1.3.7 says so explicitly. That is the
   ONLY reason skipping JWKS here is safe — if this ever accepts a token from
   the browser instead, the signature MUST be verified.
------------------------------------------------------------------- */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const googleConfigured = () =>
  !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const b64url = (b: ArrayBuffer | Uint8Array) => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const randomB64url = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(digest);
}

export const redirectUri = (origin: string) => `${origin}/api/auth/callback/google`;

/**
 * Google demands the redirect_uri be byte-identical across the registered
 * value, the authorize request and the token exchange. Deriving it from
 * `req.url` alone is not safe: behind Cloudflare the request can present as
 * http, which silently produces a mismatch and a failed sign-in.
 *
 * So: force https for anything that isn't localhost, and allow APP_ORIGIN to
 * override outright.
 */
export function originFrom(reqUrl: string): string {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/$/, "");
  const u = new URL(reqUrl);
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  return `${local ? "http" : "https"}://${u.host}`;
}

export async function authorizeUrl(origin: string) {
  const state = randomB64url(16);
  const verifier = randomB64url(32);
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    // Nothing beyond these three, ever. Anything sensitive triggers Google's
    // verification review, which spec 07 is built to stay exempt from.
    scope: "openid email profile",
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `${AUTH_ENDPOINT}?${params}`, state, verifier };
}

/** Exchanges the code and returns the verified email, or null. */
export async function emailFromCode(code: string, verifier: string, origin: string): Promise<string | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    console.error("[auth] token exchange failed:", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const tok = await res.json() as { id_token?: string };
  if (!tok.id_token) return null;

  const claims = decodeIdToken(tok.id_token);
  if (!claims?.email) return null;
  // Google sets this false for unverified addresses on some account types.
  if (claims.email_verified === false) {
    console.error("[auth] rejected an unverified Google email");
    return null;
  }
  return claims.email.toLowerCase();
}

export function decodeIdToken(idToken: string): { email?: string; email_verified?: boolean } | null {
  const part = idToken.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
