"use client";
import { useActionState } from "react";
import { login } from "../actions";
import { Btn } from "@/components/ui";

export default function PasswordForm() {
  const [state, action, pending] = useActionState(login, null as null | { error: string });
  return (
    <form action={action}>
      <label htmlFor="u" className="mb-2 block text-[13px] text-ink-soft">Username</label>
      <input id="u" name="username" autoFocus autoCapitalize="none" autoCorrect="off"
             spellCheck={false} className="field" placeholder="username" />

      <label htmlFor="pw" className="mb-2 mt-4 block text-[13px] text-ink-soft">Password</label>
      <input id="pw" name="password" type="password" className="field" placeholder="••••••••" />

      {state?.error && <p className="mt-3 text-[13px] text-stop">{state.error}</p>}
      <Btn kind="primary" className="mt-5" disabled={pending}>{pending ? "…" : "Sign in"}</Btn>
    </form>
  );
}
