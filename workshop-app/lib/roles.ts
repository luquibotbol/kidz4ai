/** Pure so it can be tested without pulling in next/headers. Spec 07. */
export type Role = "kid" | "parent";

export function roleFor(email: string | null | undefined): Role | null {
  const e = (email || "").trim().toLowerCase();
  if (!e) return null;
  const kid = (process.env.KID_EMAIL || "").trim().toLowerCase();
  const parent = (process.env.PARENT_EMAIL || "").trim().toLowerCase();
  // An unset env var must never match an empty-ish email into a role.
  if (kid && e === kid) return "kid";
  if (parent && e === parent) return "parent";
  return null;
}
