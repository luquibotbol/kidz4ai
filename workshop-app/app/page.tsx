import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import { readState } from "@/lib/db";
import App from "./App";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await session();
  if (!s) redirect("/login");
  if (s.role === "parent") redirect("/parent");   // spec 07, route table row 1
  const state = await readState(s.user);
  return <App initial={state} />;
}
