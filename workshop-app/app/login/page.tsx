import { passwordEnabled } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";
import { Mark } from "@/components/ui";
import PasswordForm from "./PasswordForm";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  notallowed: "That account isn't on the list. Ask Lucas.",
  state: "That sign-in expired. Try again.",
  expired: "That sign-in expired. Try again.",
  exchange: "Google didn't complete the sign-in. Try again.",
  nocode: "Google didn't complete the sign-in. Try again.",
};

export default async function Login({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const google = googleConfigured();

  return (
    <main className="mx-auto flex min-h-dvh max-w-[400px] flex-col justify-center px-6">
      <Mark size={30} />
      <h1 className="mt-5 font-display text-[30px] font-semibold leading-none tracking-[-0.03em]">Kids4AI</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">Make things. See what they did.</p>

      {error && <p className="mt-6 text-[14px] text-stop">{REASON[error] || "That didn't work. Try again."}</p>}

      {google && (
        <a href="/api/auth/google" className="btn btn-primary mt-8 no-underline">
          <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.9Z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7Z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44Z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C36.9 40.2 44 35 44 24a20 20 0 0 0-.4-3.9Z"/>
          </svg>
          Continue with Google
        </a>
      )}

      {passwordEnabled() && (
        <div className={google ? "" : "mt-9"}>
          {google && (
            <div className="my-7 flex items-center gap-3 text-[12px] text-ink-faint">
              <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
            </div>
          )}
          <PasswordForm />
        </div>
      )}
    </main>
  );
}
