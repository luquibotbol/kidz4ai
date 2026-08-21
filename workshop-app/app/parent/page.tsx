import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import { readState } from "@/lib/db";
import { phase, streak, totals, frictionDay, frictionText, daysBetween } from "@/lib/state";
import ParentControls from "./ParentControls";
import { runParentSignals } from "../actions";

export const dynamic = "force-dynamic";

/** Spec 04: every screen that shows a problem ships with the script for what to
    do. A dashboard without one makes the controlling text message MORE likely
    (r = -0.48 against autonomy), so the script is the feature, not a footnote. */
const SCRIPT: Record<string, { state: string; say: string }> = {
  COLD:    { state: "He hasn't started the questions yet.",
             say: "Do nothing. There is no version of chasing this that helps. He opens it or he doesn't." },
  IDLE:    { state: "No mission running right now.",
             say: "Don't assign him one. If it comes up, ask what he'd want to make if nobody was checking." },
  ACTIVE:  { state: "He's mid-mission.",
             say: "Nothing needed. This is the state you want. Resist the check-in." },
  STUCK:   { state: "He's been stuck, or he's drifted off it.",
             say: "Don't ask if he did it. Ask him to show you the thing that's broken." },
  DORMANT: { state: "Quiet for two weeks. The app has stopped messaging him, permanently.",
             say: "The app going quiet doesn't mean you do. Call him about something else entirely." },
};

export default async function Parent() {
  const who = await session();
  if (!who) redirect("/login");

  // The Window shows the KID's data. The parent's own row is not involved.
  const kid = (process.env.KID_USERNAME || "").trim().toLowerCase();
  const s = await readState(kid);
  // Time-based signals (stuck, dormant, the Sunday note) are evaluated here.
  // For one kid this is enough; a cron trigger would make it independent of
  // anyone visiting. Failure must never block the page.
  runParentSignals().catch(e => console.error("[spec05] signals failed:", e?.message));
  const t = totals(s);
  const ph = phase(s);
  const st = streak(s);
  const m = s.mission;
  const day = m ? daysBetween(m.startedAt, new Date().toISOString().slice(0, 10)) + 1 : 0;
  const hard = m ? frictionDay(m.stuck) : null;
  const notes = [...s.feedback].reverse();
  const flags = [...s.flags].reverse();
  const pending = s.requests.filter(r => r.status === "pending");
  const answered = s.requests.filter(r => r.status !== "pending").reverse();
  const script = SCRIPT[ph];

  return (
    <main className="mx-auto max-w-[620px] px-5 py-10 pb-24">
      <div className="eyebrow">The Window</div>
      <h1 className="mt-2 font-display text-[26px] font-semibold tracking-[-0.025em]">
        {s.name || kid || "Your kid"}
      </h1>
      <p className="mt-2 text-[13.5px] text-ink-faint">
        He can open this page and see exactly what you see.
      </p>

      {/* The metric here is the same as his: Made and Saw it. Never engagement. */}
      <div className="mt-7 flex divide-x divide-line border-y border-line py-4">
        {[[s.shipped.length, "Made"], [t.seen, "Saw it"], [`$${t.profit.toFixed(2)}`, "Kept"]].map(([v, k]) => (
          <div key={String(k)} className="min-w-0 flex-1 px-2.5 first:pl-0 last:pr-0">
            <div className="tnum font-display text-[26px] font-semibold leading-none">{v}</div>
            <div className="eyebrow mt-2">{k}</div>
          </div>
        ))}
      </div>

      {/* 1. Right now, with the script */}
      <section className="mt-9">
        <h2 className="eyebrow">Right now</h2>
        <div className="card mt-3 p-5">
          <p className="text-[15px] font-medium">{script.state}</p>
          {m && (
            <>
              <p className="mt-3 font-display text-[18px] font-semibold tracking-[-0.015em]">{m.title}</p>
              <p className="tnum mt-1 text-[13px] text-ink-faint">
                Day {day}{hard !== null && ` · predicted hard day: ${hard}${day > hard ? " (past it)" : ""}`}
                {st.weeks > 0 && ` · ${st.weeks} ${st.weeks === 1 ? "week" : "weeks"} running`}
              </p>
              <ul className="mt-3 space-y-1">
                {m.steps.map((step, i) => (
                  <li key={i} className={`text-[14px] ${s.stepsDone.includes(i) ? "text-ink-faint line-through" : "text-ink-soft"}`}>
                    {s.stepsDone.includes(i) ? "✓ " : "· "}{step.text}
                  </li>
                ))}
              </ul>
              {m.stuck && (
                <p className="mt-3 rounded-[10px] bg-flag-wash p-3 text-[13.5px] leading-snug">
                  <span className="font-medium">It predicted:</span> {frictionText(m.stuck)}
                  {m.frictionHit !== undefined && (
                    <span className="text-ink-soft"> — he says it {m.frictionHit ? "happened" : "didn't"}.</span>
                  )}
                </p>
              )}
            </>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <div className="eyebrow">What to say</div>
            <p className="mt-1.5 text-[14.5px] leading-relaxed">{script.say}</p>
          </div>
        </div>
      </section>

      {/* 2. What the AI expects — the honest forecast */}
      {m?.expects && (
        <section className="mt-9">
          <h2 className="eyebrow">What the AI expects</h2>
          <p className="mt-2 text-[13px] text-ink-faint">
            Its own forecast, so you can check whether its predictions are worth
            anything after a few missions. He sees this too.
          </p>
          <dl className="card mt-3 divide-y divide-line p-0">
            {[["Expects", m.expects.byWhen], ["Odds", m.expects.odds],
              ["Gets hard", m.expects.hardDay], ["If it stalls", m.expects.ifItStalls]].map(([k, v]) => v ? (
              <div key={k} className="flex gap-4 px-5 py-3">
                <dt className="eyebrow w-[86px] flex-none pt-[3px]">{k}</dt>
                <dd className="text-[14.5px] leading-snug">{v}</dd>
              </div>
            ) : null)}
          </dl>
        </section>
      )}

      {/* 4. Requests, and 5. the Kit — both interactive */}
      <ParentControls
        canEdit={who.role === "parent"}
        kit={s.kit}
        pending={pending}
        answered={answered}
      />

      {/* 3. What he made */}
      <section className="mt-9">
        <h2 className="eyebrow">What he made</h2>
        {s.shipped.length === 0 ? (
          <p className="mt-3 border-t border-line py-5 text-[14px] text-ink-faint">Nothing yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {[...s.shipped].reverse().map(x => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[14.5px] font-medium">{x.title}</div>
                  <div className="tnum text-[12.5px] text-ink-faint">{x.date}</div>
                </div>
                <span className="tnum flex-none text-[13px] text-ink-soft">{x.seenBy} saw it</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Notes he chose to send */}
      <section className="mt-9">
        <h2 className="eyebrow">From him ({notes.length})</h2>
        {notes.length === 0 ? (
          <p className="mt-3 border-t border-line py-5 text-[14px] text-ink-faint">
            Nothing yet. There&rsquo;s a button in his app for reporting something broken
            or suggesting a change.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {notes.map(n => (
              <li key={n.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-pill px-2.5 py-1 text-[11px] font-medium
                    ${n.kind === "broken" ? "bg-stop-wash text-stop" : "bg-acc-wash text-acc"}`}>
                    {n.kind === "broken" ? "Broken" : "Idea"}
                  </span>
                  <span className="tnum text-[12px] text-ink-faint">{n.at.slice(0, 16).replace("T", " ")}</span>
                </div>
                <p className="mt-2.5 whitespace-pre-wrap text-[14.5px] leading-relaxed">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {flags.length > 0 && (
        <section className="mt-9">
          <h2 className="eyebrow">Flags ({flags.length})</h2>
          <p className="mt-2 text-[13px] text-ink-faint">Category and time only. Never what was said.</p>
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {flags.map(f => (
              <li key={f.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-[14.5px] font-medium">
                    {f.kind === "report" ? "He reported a reply as wrong" : `Filter: ${f.category || "flagged"}`}
                  </div>
                  {f.reason && <div className="mt-0.5 text-[13.5px] text-ink-soft">{f.reason}</div>}
                </div>
                <span className="tnum flex-none text-[12px] text-ink-faint">{f.at.slice(0, 16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 border-t border-line pt-6">
        <h2 className="eyebrow">What is deliberately not here</h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
          Anything he says to the coach. Not summarised, not keyword-alerted, not
          the concerning ones. The single exception is a self-harm or violence
          safety flag, which reaches you as a category and a time, never as text.
          He is told this on his first screen.
        </p>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
          Also missing on purpose: session counts, time in app, anything that
          looks like a productivity chart. If you can watch a number go up you
          will optimise it, and every available number here is the wrong one.
        </p>
      </section>
    </main>
  );
}
