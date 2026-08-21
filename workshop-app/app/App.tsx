"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  generateMission, toggleStep, dropMission, shipIt, addSale, addRobux,
  removeSale, removeRobux, setName, clearCoach, restartDiscovery, logout,
  updateSeen, answerFriction, ackDisclosure, reportMessage, sendFeedback, dismissNamePrompt,
  deleteFact, pinFact, addFact, setTone, setPushOff,
  makeTool, deleteTool, setToolValues, toggleToolItem, ackTour, generateDeck,
} from "./actions";
import { Btn, Mark, Count, Confetti, Score, Sheet, Toast, DragButton, Rich,
         ShipMoment, MomentNote } from "@/components/ui";
import { streak, totals, phase, frictionDay, frictionText, frictionDue, daysBetween,
         orderedFacts, bridgePrompt, nextTease, type State } from "@/lib/state";
import { DECK } from "@/lib/deck";
import { ToolCard } from "@/components/tools";
import { Tour } from "@/components/tour";

type Tab = "now" | "coach" | "ledger" | "kit";

const TABS = [
  ["now", "Now"], ["coach", "Coach"], ["ledger", "Ledger"], ["kit", "Prompts"],
] as const;

export default function App({ initial }: { initial: State }) {
  const [s, setS] = useState(initial);
  const [tab, setTab] = useState<Tab>("now");
  const [toast, setToast] = useState<string | null>(null);
  const [party, setParty] = useState(false);
  const [note, setNote] = useState(false);
  const [settings, setSettings] = useState(false);
  // Spec 12: shown once, when it happens. Never stored as a list he can browse.
  const [shipMoment, setShipMoment] = useState<any>(null);
  const [notes, setNotes] = useState<string[]>([]);
  // Jumping to the coach with the question already typed — item 1: he may not
  // know what to ask, so ask it for him.
  const [prefill, setPrefill] = useState("");
  const goTab = (t: Tab, text?: string) => { setTab(t); if (text) setPrefill(text); };
  const [pending, start] = useTransition();

  useEffect(() => { setS(initial); }, [initial]);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1900); };
  const run = (fn: () => Promise<void>, msg?: string) =>
    start(async () => {
      try { await fn(); if (msg) say(msg); }
      catch (e: any) { say(String(e?.message || "That didn't work").slice(0, 70)); }
    });

  const t = totals(s);
  const st = streak(s);
  const ph = phase(s);

  if (!s.disclosureSeenAt) return <Disclosure onOk={() => run(() => ackDisclosure())} />;
  // Item 5: the short walkthrough, once, before the questions.
  if (!s.tourSeenAt) return <Tour onDone={() => run(() => ackTour())} />;

  return (
    <div className="mx-auto min-h-dvh max-w-[560px] pb-24">
      <Confetti on={party} />
      <Toast msg={toast} />

      {shipMoment && (
        <ShipMoment {...shipMoment} onClose={() => setShipMoment(null)} />
      )}

      <main className="px-5 pt-6">
        {tab === "now"    && <Now {...{ s, t, st, ph, run, pending, setParty, setTab: goTab, say,
                                       openSettings: () => setSettings(true), setShipMoment, notes, setNotes }} />}
        {tab === "coach"  && <Coach {...{ s, say, prefill, clearPrefill: () => setPrefill("") }} />}
        {tab === "ledger" && <Ledger {...{ s, t, run, setNotes, setTab: goTab }} />}
        {tab === "kit"    && <Kit {...{ s, say, run, pending }} />}
      </main>

      <DragButton onPress={() => setNote(true)} label="Send Lucas a note">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.7L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
        </svg>
      </DragButton>

      <Sheet open={settings} onClose={() => setSettings(false)} title="Settings">
        <You s={s} run={run} />
      </Sheet>

      <NoteSheet open={note} onClose={() => setNote(false)}
        onSend={(kind: "idea" | "broken", text: string) => {
          setNote(false);
          run(() => sendFeedback(kind, text), "Sent to Lucas");
        }} />

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-[560px] px-3 pb-[env(safe-area-inset-bottom)]">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              aria-current={tab === k ? "page" : undefined}
              className={`flex-1 border-t-2 py-3 text-[13px] font-medium transition-colors
                          ${tab === k ? "border-ink text-ink" : "border-transparent text-ink-faint hover:text-ink-soft"}`}>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function NoteSheet({ open, onClose, onSend }: any) {
  const [kind, setKind] = useState<"idea" | "broken">("broken");
  const [text, setText] = useState("");
  useEffect(() => { if (open) { setKind("broken"); setText(""); } }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="Tell Lucas something">
      <p className="text-[14.5px] leading-relaxed text-ink-soft">
        Something broken, or an idea for how this should work. It goes on a list
        Lucas reads.
      </p>
      <div className="mt-4 flex gap-2">
        {([["broken", "Something's broken"], ["idea", "I have an idea"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)}
            className={`flex-1 rounded-[10px] border py-2.5 text-[14px] font-medium transition-colors
                        ${kind === k ? "border-acc bg-acc-wash text-acc" : "border-line-strong text-ink-soft hover:border-ink/30"}`}>
            {label}
          </button>
        ))}
      </div>
      <textarea className="field mt-4" rows={4} autoFocus value={text}
        onChange={e => setText(e.target.value)}
        placeholder={kind === "broken" ? "what happened, and what you were doing" : "what should it do instead"} />
      <Btn kind="primary" className="mt-4" disabled={!text.trim()} onClick={() => onSend(kind, text)}>
        Send
      </Btn>
    </Sheet>
  );
}

/* ============================================================ DISCLOSURE
   Spec 09 section 1. Copy is verbatim from the spec and follows VOICE:
   no cheerleading, no scare copy. Shown once, gated on disclosureSeenAt. */
function Disclosure({ onOk }: { onOk: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-6 py-10">
      <Mark size={26} />
      <h1 className="mt-5 font-display text-[26px] font-semibold tracking-[-0.025em]">Before we start</h1>
      <div className="mt-5 space-y-4 text-[15.5px] leading-relaxed text-ink-soft">
        <p>
          I&rsquo;m an AI. Not a person. I get things wrong, including confidently.
          Check anything that involves money or your real name.
        </p>
        <p>
          Lucas can see what you&rsquo;re building and what it earned.
          He can&rsquo;t see what you say to me.
        </p>
        <p>
          If I ever say something that feels wrong, hit the flag button.
          It goes straight to Lucas.
        </p>
      </div>
      <Btn kind="primary" className="mt-8" onClick={onOk}>Got it</Btn>
    </main>
  );
}

/* ============================================================ NOW */
function Now({ s, t, st, ph, run, pending, setParty, setTab, say, openSettings, setShipMoment, notes, setNotes }: any) {
  // Discovery is long. Someone who stops halfway needs to be told it's saved,
  // or they'll assume they have to start over.
  const startedDiscovery = s.chat.discovery.length > 0;
  const answered = s.chat.discovery.filter((m: any) => m.role === "user").length;
  const [shipOpen, setShipOpen] = useState(false);
  // Ask once. If he skips it, nameAskedAt stops it reappearing every login.
  const [nameOpen, setNameOpen] = useState(!s.name && !s.nameAskedAt);

  return (
    <>
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Mark state={s.mission ? "on" : s.shipped.length ? "done" : "idle"} size={22} />
            <span className="eyebrow">Kids4AI</span>
          </div>
          <h1 className="mt-3 font-display text-[28px] font-semibold leading-none tracking-[-0.025em]">
            {s.name || "Hello"}
          </h1>
          <div className="mt-1.5 flex items-center gap-3">
            <button onClick={() => setNameOpen(true)}
                    className="text-[13px] text-ink-faint underline underline-offset-4 hover:text-ink-soft">
              {s.name ? "not you?" : "set your name"}
            </button>
            <button onClick={openSettings}
                    className="text-[13px] text-ink-faint underline underline-offset-4 hover:text-ink-soft">
              settings
            </button>
          </div>
        </div>
        {st.weeks > 0 && (
          <div className="rounded-pill border border-line px-3 py-1.5 text-[12px] font-medium text-ink-soft">
            {st.weeks} {st.weeks === 1 ? "week" : "weeks"} running
          </div>
        )}
      </header>

      <div className="mt-7 flex divide-x divide-line border-y border-line py-4">
        <Score v={<Count to={s.shipped.length} />} k="Made" />
        <Score v={<Count to={t.seen} />} k={t.seen === 1 ? "person saw it" : "saw it"} tone="acc" />
        <Score v={<Count to={t.profit} prefix="$" decimals={2} />} k="Kept" tone="gain" />
      </div>

      {ph === "COLD" && startedDiscovery && (
        <section className="card mt-6 p-5">
          <div className="eyebrow">Unfinished</div>
          <h2 className="mt-2 font-display text-[19px] font-semibold tracking-[-0.015em]">
            You&rsquo;re partway through the questions
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            {answered === 0
              ? "You haven't answered any yet. Nothing is lost — it picks up where you left off."
              : `${answered} ${answered === 1 ? "answer" : "answers"} saved. It picks up where you left off, so you don't repeat anything.`}
          </p>
          <div className="mt-5 flex gap-2.5">
            <Btn kind="accent" onClick={() => setTab("coach")}>Keep going</Btn>
            <Btn kind="quiet" disabled={pending}
                 onClick={() => run(() => restartDiscovery(), "Cleared. Start again in Coach.")}>
              Start over
            </Btn>
          </div>
        </section>
      )}

      {ph === "COLD" && !startedDiscovery && (
        <section className="card mt-6 p-5">
          <h2 className="font-display text-[19px] font-semibold tracking-[-0.015em]">
            What this is
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            You pick something to make — a game, a design, something people will
            pay for. This gives you <span className="text-ink">the steps, one project at a time</span>.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            When something breaks, ask it here. Any time, including midnight.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            It counts what you made, how many people outside your family saw it,
            and what you earned. No lessons, no homework.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            First it needs to know what you&rsquo;ve actually made and sold. That&rsquo;s
            about 25 minutes of questions.
          </p>
          <div className="mt-5 flex gap-2.5">
            <Btn kind="accent" onClick={() => setTab("coach")}>Start</Btn>
            <Btn kind="quiet" onClick={() => setTab("ledger")}>Not now</Btn>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-faint">
            &ldquo;Not now&rdquo; is a real button. Nothing will nag you.
          </p>
        </section>
      )}

      {s.mission ? (
        <MissionCard {...{ s, run, pending, setShipOpen, setTab, say, setNotes }} />
      ) : ph !== "COLD" && (
        <section className="card mt-6 p-5">
          <h2 className="font-display text-[19px] font-semibold tracking-[-0.015em]">
            {s.shipped.length > 0 ? `${s.shipped.length} made. Ready for the next?` : "Nothing on right now"}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            {s.shipped.length > 0 ? nextTease(s) : "One thing at a time, small enough to finish this week."}
          </p>
          <Btn kind="accent" className="mt-5" disabled={pending}
               onClick={() => run(() => generateMission())}>
            {pending ? "Working it out…" : "Give me something"}
          </Btn>
        </section>
      )}

      <MomentNote lines={notes} onClose={() => setNotes([])} />

      {s.tools.length > 0 && (
        <section className="mt-7">
          <h2 className="eyebrow">Your tools</h2>
          {s.tools.map((tool: any) => (
            <ToolCard key={tool.id} tool={tool}
              onDelete={() => run(() => deleteTool(tool.id), "Deleted")}
              onValues={v => setToolValues(tool.id, v)}
              onToggle={i => run(() => toggleToolItem(tool.id, i))} />
          ))}
        </section>
      )}

      {s.requests.filter((r: any) => r.status === "pending").map((r: any) => (
        <section key={r.id} className="card mt-6 p-5">
          <div className="eyebrow">Waiting on Lucas</div>
          <p className="mt-2 text-[15px] leading-relaxed">
            Asked him for <span className="font-medium">{r.what}</span>.
          </p>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
            <span className="text-ink">Meanwhile:</span> {r.workaround}
          </p>
        </section>
      ))}

      {s.shipped.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow">
            Exists now — {s.shipped.length} thing{s.shipped.length === 1 ? "" : "s"}
            {t.seen > 0 && `, ${t.seen} ${t.seen === 1 ? "person" : "people"} outside your family`}
          </h2>
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {[...s.shipped].reverse().map((x: any) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{x.title}</div>
                  <div className="text-[12.5px] text-ink-faint">{x.date}</div>
                </div>
                <SeenBy id={x.id} n={x.seenBy} run={run} setNotes={setNotes} />
              </li>
            ))}
          </ul>
        </section>
      )}


      <p className="mt-10 border-t border-line pt-5 text-[13px] leading-relaxed text-ink-faint">
        Lucas can see: your missions, what you shipped, your money, and anything
        you send him. He can&rsquo;t see your chats with me.{" "}
        <a href="/parent" className="underline underline-offset-4 hover:text-ink-soft">
          Look at his page
        </a>.
      </p>

      <button onClick={() => logout()}
              className="mx-auto mt-10 block text-[13px] text-ink-faint underline underline-offset-4">
        Sign out
      </button>

      <ShipSheet open={shipOpen} onClose={() => setShipOpen(false)} mission={s.mission}
        onSave={(title: string, note: string, seen: number) => {
          setShipOpen(false);
          setParty(true); setTimeout(() => setParty(false), 1400);
          run(async () => {
            const r: any = await shipIt(title, note, seen);
            if (r) setShipMoment({
              title: r.title, made: r.made, seenBy: r.seenBy, days: r.days,
              lines: (r.moments || []).map((m: any) => m.line), tease: r.tease,
            });
          });
        }} />

      <Sheet open={nameOpen}
             onClose={() => { setNameOpen(false); run(() => dismissNamePrompt()); }}
             title="What should I call you">
        <NameForm initial={s.name} onSave={(v) => { setNameOpen(false); run(() => setName(v)); }} />
      </Sheet>
    </>
  );
}

/* ---------------- the mission, and the prediction ---------------- */
function MissionCard({ s, run, pending, setShipOpen, setTab, say, setNotes }: any) {
  const m = s.mission;
  const day = frictionDay(m.stuck);
  const due = frictionDue(m);
  const elapsed = daysBetween(m.startedAt, new Date().toISOString().slice(0, 10));

  return (
    <section className="card mt-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="eyebrow">
          {s.shipped.length > 0 ? `Thing #${s.shipped.length + 1}` : "Right now"}
        </span>
        <span className="tnum text-[12px] text-ink-faint">
          day {elapsed + 1}
        </span>
      </div>

      <div className="p-5">
        <h2 className="font-display text-[22px] font-semibold leading-[1.15] tracking-[-0.02em]">{m.title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{m.why}</p>

        {m.needs?.length > 0 && (
          <div className="mt-4 rounded-[10px] border border-line bg-canvas px-3.5 py-3">
            <div className="eyebrow">What you need open</div>
            <p className="mt-1.5 text-[14px] leading-snug">{m.needs.join(" · ")}</p>
          </div>
        )}

        <ul className="mt-5 space-y-1.5">
          {m.steps.map((step: any, i: number) => {
            const done = s.stepsDone.includes(i);
            return (
              <li key={i}>
                <button onClick={() => run(() => toggleStep(i))}
                  aria-pressed={done}
                  className="group flex w-full items-start gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-canvas">
                  <span className={`mt-[2px] flex h-[19px] w-[19px] flex-none items-center justify-center rounded-[6px] border transition-colors
                                   ${done ? "border-gain bg-gain" : "border-line-strong bg-surface group-hover:border-ink/40"}`}>
                    {done && (
                      <svg width="11" height="11" viewBox="0 0 12 12" className="animate-tick">
                        <path d="M2.5 6.5 L5 9 L9.5 3.5" stroke="#fff" strokeWidth="2"
                              strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-[14.5px] leading-snug ${done ? "text-ink-faint line-through" : "text-ink"}`}>
                    {step.text}
                  </span>
                </button>
                {!done && (
                  <div className="mb-1 ml-[34px] mt-1 flex flex-wrap gap-2">
                    {step.prompt && <AskAi prompt={bridgePrompt(s, i) || step.prompt} say={say} />}
                    <button onClick={() => setTab("coach", `I don't know how to do this step: ${step.text}`)}
                      className="rounded-pill border border-line-strong px-3 py-1.5 text-[12.5px] text-ink-soft transition hover:border-ink/30 hover:text-ink">
                      I don&rsquo;t know how
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* The prediction. This is the thing the app is betting its credibility on. */}
        {m.stuck && (
          <div className={`mt-5 rounded-[12px] border p-4 transition-colors
                           ${due ? "border-flag/40 bg-flag-wash" : "border-line bg-canvas"}`}>
            <div className="flex gap-3.5">
              {day !== null && (
                <div className="flex-none text-center">
                  <div className="eyebrow leading-none">Day</div>
                  <div className="tnum font-display text-[26px] font-semibold leading-none text-flag">{day}</div>
                </div>
              )}
              <div className="min-w-0">
                <div className="eyebrow">Where this gets hard</div>
                <p className="mt-1.5 text-[14px] leading-snug text-ink">{frictionText(m.stuck)}</p>
              </div>
            </div>

            {due && (
              <div className="mt-4 border-t border-flag/25 pt-3.5">
                <p className="text-[13.5px] font-medium">Did that actually happen?</p>
                <div className="mt-2.5 flex gap-2">
                  <Btn kind="quiet" className="!py-2 !text-[13.5px]"
                       onClick={() => run(async () => {
                         const r: any = await answerFriction(true);
                         const lines = (r?.moments || []).map((m: any) => m.line);
                         if (lines.length) setNotes(lines); else say("Called it");
                       })}>It happened</Btn>
                  <Btn kind="quiet" className="!py-2 !text-[13.5px]"
                       onClick={() => run(() => answerFriction(false), "Noted — the call was wrong")}>It didn&rsquo;t</Btn>
                </div>
              </div>
            )}

            {m.frictionHit !== undefined && (
              <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-faint">
                {m.frictionHit ? "You said this happened." : "You said this didn't happen. Good — it was wrong."}
              </p>
            )}
          </div>
        )}

        {m.expects && (m.expects.byWhen || m.expects.odds) && (
          <details className="mt-5 rounded-[12px] border border-line bg-canvas p-4">
            <summary className="cursor-pointer text-[13.5px] font-medium">
              What it reckons will happen
            </summary>
            <dl className="mt-3 space-y-2">
              {[["Takes", m.expects.byWhen], ["Odds", m.expects.odds],
                ["Gets hard", m.expects.hardDay], ["If it stalls", m.expects.ifItStalls]]
                .filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string} className="flex gap-3">
                  <dt className="eyebrow w-[74px] flex-none pt-[2px]">{k}</dt>
                  <dd className="text-[13.5px] leading-snug text-ink-soft">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12.5px] text-ink-faint">
              Lucas sees this too. If it&rsquo;s wrong, that&rsquo;s worth knowing.
            </p>
          </details>
        )}

        <PasteBack s={s} say={say} run={run} />

        <p className="mt-5 text-[14.5px] leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Done when:</span> {m.done}
        </p>

        <div className="mt-6 space-y-2.5">
          <Btn kind="quiet" disabled={pending}
               onClick={() => run(async () => {
                 const r = await makeTool();
                 if (r?.error) say(r.error); else say("Made you something. It's below the mission.");
               })}>
            {pending ? "Building…" : "Make me something for this"}
          </Btn>
          <Btn kind="primary" onClick={() => setShipOpen(true)}>I made it</Btn>
          <div className="flex gap-2.5">
            <Btn kind="quiet" onClick={() => setTab("coach")}>I&rsquo;m stuck</Btn>
            <Btn kind="quiet" disabled={pending}
                 onClick={() => run(() => dropMission(), "Dropped. Next one will be smaller.")}>
              Drop it
            </Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Spec 08 + Phase 1: hand the step's prompt to his own AI chat.

   The prompt is SHOWN, not just copied. The old version caught a clipboard
   failure and said "press and hold to copy it manually" while rendering the
   prompt nowhere — a dead end, and the failure is likely on iOS, where a write
   after an await falls outside the user-gesture window. So: write synchronously
   inside the handler, and keep the text on screen either way. */
function AskAi({ prompt, say }: { prompt: string; say: (m: string) => void }) {
  const [open, setOpen] = useState(false);

  const copy = () => {
    try {
      navigator.clipboard.writeText(prompt);      // sync — no await before it
      say("Copied.");
    } catch {
      setOpen(true);
      say("Couldn't copy. Select it below.");
    }
  };
  const go = (url: string) => {
    copy();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mb-1 ml-[34px] mt-1 w-full">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => go("https://gemini.google.com/app")}
          className="rounded-pill border border-line-strong px-3 py-1.5 text-[12.5px] text-ink-soft transition hover:border-ink/30 hover:text-ink">
          Do this in Gemini
        </button>
        <button onClick={() => go("https://chatgpt.com/")}
          className="rounded-pill border border-line-strong px-3 py-1.5 text-[12.5px] text-ink-soft transition hover:border-ink/30 hover:text-ink">
          or ChatGPT
        </button>
        <button onClick={() => setOpen(!open)}
          className="rounded-pill px-2 py-1.5 text-[12.5px] text-ink-faint underline underline-offset-4 hover:text-ink-soft">
          {open ? "hide" : "see what it sends"}
        </button>
      </div>

      {open && (
        <div className="mt-2 rounded-[10px] border border-line bg-canvas p-3">
          <p className="whitespace-pre-wrap text-[12.5px] leading-snug text-ink-soft">{prompt}</p>
          <button onClick={copy}
            className="mt-2 rounded-pill border border-line-strong bg-surface px-3 py-1 text-[12px] text-ink-soft hover:border-ink/30 hover:text-ink">
            Copy it
          </button>
        </div>
      )}
    </div>
  );
}

/* The return path. Without this the handoff is one-directional and the app goes
   blind the moment he leaves — spec 08 calls it the most important element.

   Phase 1: it used to be a single box labelled "paste anything that didn't
   work", which had no path for the commoner case (it worked, what now) and
   arrived at the coach with no idea which step it belonged to. Now the outcome
   is explicit and the step travels with it. */
function PasteBack({ s, say, run }: any) {
  const [outcome, setOutcome] = useState<"worked" | "broke" | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const steps = s.mission?.steps || [];
  const firstOpen = steps.findIndex((_: any, i: number) => !s.stepsDone.includes(i));
  const [stepIndex, setStepIndex] = useState(firstOpen < 0 ? 0 : firstOpen);

  const send = async () => {
    const t = text.trim();
    if (!t || busy || !outcome) return;
    setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "coach", text: t, stepIndex, outcome }),
      });
      const j = await r.json() as { reply?: string; error?: string };
      if (!r.ok) throw new Error(j.error || "That didn't send.");
      setText(""); setOutcome(null);
      say(outcome === "worked" ? "Step ticked. The coach has the next move." : "Sent. The coach has it.");
      run(async () => {});   // refresh state so the tick shows
    } catch (e: any) {
      say(String(e?.message || "That didn't send.").slice(0, 60));
    }
    setBusy(false);
  };

  return (
    <div className="mt-5 rounded-[12px] border border-line bg-canvas p-4">
      <div className="eyebrow">Back from your AI?</div>
      <div className="mt-2.5 flex gap-2">
        {([["worked", "It worked"], ["broke", "It broke"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setOutcome(outcome === k ? null : k)}
            className={`flex-1 rounded-[10px] border py-2 text-[13.5px] font-medium transition-colors
                        ${outcome === k
                          ? (k === "worked" ? "border-gain bg-gain-wash text-gain" : "border-flag bg-flag-wash text-flag")
                          : "border-line-strong text-ink-soft hover:border-ink/30"}`}>
            {label}
          </button>
        ))}
      </div>

      {outcome && (
        <>
          {steps.length > 1 && (
            <select value={stepIndex} onChange={e => setStepIndex(Number(e.target.value))}
              className="field mt-3 bg-surface py-2 text-[13px]">
              {steps.map((st: any, i: number) => (
                <option key={i} value={i}>Step {i + 1}: {String(st.text).slice(0, 48)}</option>
              ))}
            </select>
          )}
          <textarea rows={3} value={text} onChange={e => setText(e.target.value)}
            className="field mt-3 resize-none bg-surface"
            placeholder={outcome === "worked"
              ? "what you ended up with (one line is fine)"
              : "paste the error, or what happened"} />
          <Btn kind="quiet" className="mt-3 !py-2 !text-[13.5px]" disabled={busy || !text.trim()} onClick={send}>
            {busy ? "Sending…" : outcome === "worked" ? "Tick it off" : "Send to the coach"}
          </Btn>
        </>
      )}
    </div>
  );
}

function SeenBy({ id, n, run, setNotes }: any) {
  // "Saw it" is the number spec 12 calls the strongest one on the screen, and
  // the only input to the first-stranger and best-reach moments. A blur-only
  // save loses the edit whenever the phone locks, the tab closes, or he taps
  // away mid-type — silently, with the field still showing the number he
  // typed. So: save shortly after typing stops, on blur, and on the way out.
  const [v, setV] = useState<number | "">(n);
  const saved = useRef<number>(n);    // what the server has confirmed
  const pending = useRef<number>(n);  // what the field is showing
  const timer = useRef<any>(null);

  // Every commit revalidates, so a fresh `n` comes back down after each save.
  // Adopt it, so the field and the scoreboard can never disagree.
  useEffect(() => { saved.current = n; pending.current = n; setV(n); }, [n]);

  const commit = () => {
    clearTimeout(timer.current);
    const val = pending.current;
    if (val === saved.current) return;
    saved.current = val;
    run(async () => {
      const r: any = await updateSeen(id, val);
      const lines = (r || []).map((m: any) => m.line);
      if (lines.length) setNotes?.(lines);
    });
  };
  useEffect(() => () => commit(), []);

  const edit = (raw: string) => {
    // Let the field go empty while he retypes, but never save that as a 0.
    setV(raw === "" ? "" : Math.max(0, Math.floor(+raw) || 0));
    pending.current = raw === "" ? saved.current : Math.max(0, Math.floor(+raw) || 0);
    clearTimeout(timer.current);
    timer.current = setTimeout(commit, 800);
  };

  return (
    <label className="flex flex-none items-center gap-1.5 rounded-pill border border-line px-2.5 py-1">
      <input type="number" min={0} value={v} inputMode="numeric"
        onChange={e => edit(e.target.value)}
        enterKeyHint="done"
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
        onBlur={() => { if (v === "") setV(saved.current); commit(); }}
        aria-label="How many people outside your family have seen this"
        className="tnum w-10 bg-transparent text-right text-[16px] font-medium outline-none" />
      <span className="text-[11px] text-ink-faint">saw it</span>
    </label>
  );
}

function NameForm({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <input className="field" autoFocus value={v} onChange={e => setV(e.target.value)} placeholder="first name" />
      <Btn kind="primary" className="mt-4" onClick={() => v.trim() && onSave(v)}>Save</Btn>
    </>
  );
}

function ShipSheet({ open, onClose, mission, onSave }: any) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [seen, setSeen] = useState(0);
  useEffect(() => { if (open) { setTitle(mission?.title || ""); setNote(""); setSeen(0); } }, [open, mission]);
  return (
    <Sheet open={open} onClose={onClose} title="What did you make">
      <input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="name it" />
      <p className="mb-2 mt-5 text-[13px] font-medium">Anyone outside your family seen it?</p>
      <div className="flex gap-2">
        {[0, 1, 3, 10].map(n => (
          <button key={n} onClick={() => setSeen(n)}
            className={`flex-1 rounded-[10px] border py-2.5 text-[15px] font-medium transition-colors
                        ${seen === n ? "border-acc bg-acc-wash text-acc" : "border-line-strong text-ink-soft hover:border-ink/30"}`}>
            {n === 0 ? "Nobody" : n === 10 ? "10+" : n}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12.5px] text-ink-faint">Nobody is a fine answer. It just gets counted.</p>
      <textarea className="field mt-5" rows={2} value={note} onChange={e => setNote(e.target.value)}
        placeholder="what broke, what you'd change (optional)" />
      <Btn kind="primary" className="mt-4" onClick={() => title.trim() && onSave(title, note, seen)}>Save it</Btn>
    </Sheet>
  );
}

/* ============================================================ COACH */
function Coach({ s, say, prefill, clearPrefill }: any) {
  const mode: "discovery" | "coach" = !s.discoveryDone ? "discovery" : "coach";
  const [flagIdx, setFlagIdx] = useState<number | null>(null);
  const [log, setLog] = useState<any[]>(s.chat[mode]);
  const [text, setText] = useState(prefill || "");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Arriving from "I don't know how" — drop the question in, don't send it.
  useEffect(() => { if (prefill) { setText(prefill); clearPrefill?.(); } }, [prefill]);

  useEffect(() => { setLog(s.chat[mode]); }, [s, mode]);
  useEffect(() => { boxRef.current?.scrollTo(0, boxRef.current.scrollHeight); }, [log, busy]);
  useEffect(() => {
    if (mode === "discovery" && s.chat.discovery.length === 0 && !started.current) {
      started.current = true; send("", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(t: string, silent = false) {
    if (busy) return;
    setBusy(true);
    if (!silent && t) setLog(l => [...l, { role: "user", content: t }]);
    setText("");
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, text: t }),
      });
      const j = await r.json() as { reply?: string; error?: string; planComplete?: boolean };
      if (!r.ok) throw new Error(j.error || "Something broke.");
      setLog(l => [...l, { role: "assistant", content: j.reply ?? "" }]);
      if (j.planComplete) { say("Plan saved"); setTimeout(() => location.reload(), 1400); }
    } catch (e: any) {
      setLog(l => [...l, { role: "system", content: String(e?.message || "Something broke.") }]);
    }
    setBusy(false);
  }

  // 84px = the page's top padding plus the fixed tab bar. Anything larger
  // leaves dead space between the composer and the nav on a phone.
  return (
    <div className="flex h-[calc(100dvh-84px-env(safe-area-inset-bottom))] flex-col">
      <header className="flex items-center justify-between pb-4">
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em]">
          {mode === "discovery" ? "Questions" : "Coach"}
        </h1>
        {mode === "coach" && log.length > 0 && (
          <button onClick={() => { clearCoach(); setLog([]); }}
                  className="text-[13px] text-ink-faint underline underline-offset-4">Clear</button>
        )}
      </header>

      <div ref={boxRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-3">
        {log.length === 0 && !busy && mode === "coach" && (
          <p className="py-10 text-center text-[15px] text-ink-faint">
            Ask anything. Or paste what broke.
          </p>
        )}
        {log.map((m: any, i: number) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-[14px] px-4 py-3 text-[15px] leading-relaxed animate-rise
              ${m.role === "user"
                ? "rounded-br-[4px] bg-ink text-white"
                : m.role === "system"
                ? "mx-auto border border-stop/25 bg-stop-wash text-center text-[13px] text-stop"
                : "mr-auto rounded-bl-[4px] border border-line bg-surface"}`}>
              <Rich text={m.content} />
            </div>
            {m.role === "assistant" && (
              <button onClick={() => setFlagIdx(i)}
                      aria-label="Report that this reply was wrong"
                      className="mt-1.5 text-[12px] text-ink-faint underline underline-offset-4 hover:text-ink-soft">
                This reply was wrong
              </button>
            )}
          </div>
        ))}
        {busy && (
          <div className="mr-auto flex gap-1.5 rounded-[14px] rounded-bl-[4px] border border-line bg-surface px-4 py-4">
            {[0, 1, 2].map(i => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint"
                    style={{ animationDelay: `${i * 130}ms` }} />
            ))}
          </div>
        )}
      </div>

      <FlagSheet open={flagIdx !== null} onClose={() => setFlagIdx(null)}
        onSend={(reason: string) => {
          setFlagIdx(null);
          reportMessage(reason);
          say("Sent to Lucas. That's useful.");
        }} />

      <div className="sticky bottom-0 flex flex-none items-end gap-2 border-t border-line bg-canvas pt-3">
        <textarea rows={1} value={text} onChange={e => setText(e.target.value)}
          enterKeyHint="send" autoCapitalize="sentences"
          onFocus={() => {
            // When the keyboard opens the viewport shrinks; keep the newest
            // message in view instead of leaving him staring at the middle.
            setTimeout(() => boxRef.current?.scrollTo(0, boxRef.current.scrollHeight), 250);
          }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 640) { e.preventDefault(); send(text.trim()); } }}
          placeholder={mode === "discovery" ? "Type your answer" : "What are you working on"}
          className="field max-h-28 flex-1 resize-none rounded-[20px] py-2.5" />
        <button onClick={() => text.trim() && send(text.trim())} disabled={busy || !text.trim()}
          aria-label="Send"
          className="h-[44px] w-[44px] flex-none rounded-full bg-ink text-white transition
                     active:scale-95 disabled:opacity-30">
          <svg width="18" height="18" viewBox="0 0 24 24" className="mx-auto" fill="none"
               stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function FlagSheet({ open, onClose, onSend }: any) {
  const [why, setWhy] = useState("");
  useEffect(() => { if (open) setWhy(""); }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="This reply was wrong">
      <p className="text-[14.5px] leading-relaxed text-ink-soft">
        This goes to Lucas. He sees that you reported a reply, and whatever you
        write here. He does not see the conversation itself.
      </p>
      <textarea className="field mt-4" rows={2} value={why} onChange={e => setWhy(e.target.value)}
        placeholder="what was wrong with it (optional)" />
      <Btn kind="primary" className="mt-4" onClick={() => onSend(why)}>Send</Btn>
    </Sheet>
  );
}

/* ============================================================ YOU
   Spec 01's second half. A hidden user model that can't be corrected is
   surveillance; showing it is what makes it autonomy-supportive. Ship both
   halves or neither. */
function You({ s, run }: any) {
  const [text, setText] = useState("");
  const facts = orderedFacts(s.profile);
  const mine = facts.filter((f: any) => f.source === "manual");    // he wrote these
  const picked = facts.filter((f: any) => f.source !== "manual");  // the app inferred these

  return (
    <>
      {/* Spec 06: the dial he controls. Where he sets it is itself a signal. */}
      <section className="border-b border-line pb-4">
        <div className="eyebrow">How should I talk?</div>
        <div className="mt-3 space-y-2">
          {([
            ["straight", "Straight up", "Short and blunt."],
            ["warm", "Warmer", "Same info, less cold."],
            ["detail", "Full detail", "Explain more, longer answers."],
          ] as const).map(([k, label, hint]) => (
            <button key={k} onClick={() => run(() => setTone(k))}
              aria-pressed={s.tone === k}
              className={`flex w-full items-start gap-3 rounded-[10px] border px-3 py-2.5 text-left transition-colors
                          ${s.tone === k ? "border-acc bg-acc-wash" : "border-line-strong hover:border-ink/30"}`}>
              <span className={`mt-[3px] flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full border
                               ${s.tone === k ? "border-acc" : "border-line-strong"}`}>
                {s.tone === k && <span className="h-[7px] w-[7px] rounded-full bg-acc" />}
              </span>
              <span>
                <span className={`text-[14.5px] font-medium ${s.tone === k ? "text-acc" : "text-ink"}`}>{label}</span>
                <span className="ml-2 text-[13px] text-ink-soft">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Item 4: what HE says he's into leads. The inferred facts stay visible
          but folded away — "if he can't see it, don't store it" still holds,
          it just isn't the first thing he reads about himself. */}
      <h2 className="eyebrow mt-8">Things I like to do</h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
        Tell me what you&rsquo;re into. I use this when I pick what to build next.
      </p>

      {mine.length === 0 ? (
        <p className="mt-4 border-t border-line py-6 text-center text-[14px] text-ink-faint">
          Nothing yet. Add anything — games, drawing, cars, whatever.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {mine.map((f: any) => (
            <li key={f.id} className="flex items-start gap-3 py-3">
              <span className="mt-[3px] flex-none text-[13px] text-acc">★</span>
              <p className="min-w-0 flex-1 text-[14.5px] leading-snug">{f.text}</p>
              <button onClick={() => run(() => deleteFact(f.id), "Deleted")}
                aria-label="Delete this"
                className="-m-1 flex-none p-1 text-[17px] leading-none text-ink-faint hover:text-stop">×</button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <textarea id="fact" rows={2} value={text} onChange={e => setText(e.target.value)}
          className="field resize-none"
          placeholder="e.g. I like building stuff in Minecraft. Or: stop suggesting Roblox, I quit in August" />
        <Btn kind="quiet" className="mt-3" disabled={!text.trim()}
             onClick={() => { const v = text; setText(""); run(() => addFact(v), "Added"); }}>
          Add it
        </Btn>
      </div>

      {picked.length > 0 && (
        <details className="mt-8 border-t border-line pt-5">
          <summary className="cursor-pointer text-[14px] text-ink-soft">
            Stuff I&rsquo;ve worked out on my own ({picked.length})
          </summary>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
            Picked up from what you&rsquo;ve made and sold. Delete anything wrong.
          </p>
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {picked.map((f: any) => (
              <li key={f.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-snug text-ink-soft">{f.text}</p>
                  <p className="mt-0.5 text-[12px] text-ink-faint">from {f.source} · {f.addedAt}</p>
                </div>
                <button onClick={() => run(() => deleteFact(f.id), "Deleted. It won't come back.")}
                  aria-label="Delete this"
                  className="-m-1 flex-none p-1 text-[16px] leading-none text-ink-faint hover:text-stop">×</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="mt-8 border-t border-line pt-5">
        <div className="eyebrow">The questions</div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          You can answer them again if what you&rsquo;re into has changed. It replaces
          what I worked out last time.
        </p>
        <Btn kind="quiet" className="mt-3 !w-auto !px-4 !py-2 !text-[13.5px]"
             onClick={() => run(() => restartDiscovery(), "Cleared. Head to Coach.")}>
          Redo the questions
        </Btn>
      </section>

      <section className="mt-8 border-t border-line pt-5">
        <div className="eyebrow">Messages from me</div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          At most one a week, and only when I actually have something for you.
          Never to tell you time passed.
        </p>
        <Btn kind="quiet" className="mt-3 !w-auto !px-4 !py-2 !text-[13.5px]"
             onClick={() => run(() => setPushOff(!s.pushOff), s.pushOff ? "Back on" : "Off. Lucas still gets his emails.")}>
          {s.pushOff ? "Turn them back on" : "Turn these off"}
        </Btn>
      </section>

    </>
  );
}

/* ============================================================ LEDGER */
function Ledger({ s, t, run, setNotes, setTab }: any) {
  const [sale, setSale] = useState(false);
  const [rbx, setRbx] = useState(false);
  const NEED = 30000, RATE = 0.0038;
  const pct = Math.min(100, (t.rbx / NEED) * 100);

  return (
    <>
      <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em]">Ledger</h1>

      <div className="mt-5 flex divide-x divide-line border-y border-line py-4">
        <Score v={<Count to={t.profit} prefix="$" decimals={2} />} k="Kept" tone="gain" />
        <Score v={<Count to={t.units} />} k="Sold" />
        <Score v={<Count to={t.margin * 100} suffix="%" />} k="Margin" tone="acc" />
      </div>

      <div className="mt-4 flex gap-2.5">
        <Btn kind="primary" onClick={() => setSale(true)}>Add a sale</Btn>
        <Btn kind="quiet" onClick={() => setRbx(true)}>Add Robux</Btn>
      </div>

      <section className="mt-8">
        <h2 className="eyebrow">Sales</h2>
        {s.sales.length === 0
          ? <p className="border-t border-line py-6 text-center text-[14px] text-ink-faint">Nothing sold yet.</p>
          : <ul className="mt-3 divide-y divide-line border-t border-line">
              {[...s.sales].reverse().map((x: any) => (
                <li key={x.id} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium">{x.product}</div>
                    <div className="tnum text-[12.5px] text-ink-faint">
                      {x.date} · {x.units} × ${x.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-[15px] font-medium text-gain">
                      +${(x.units * (x.price - x.cost)).toFixed(2)}
                    </span>
                    <button onClick={() => run(() => removeSale(x.id))} aria-label="Remove"
                            className="text-[17px] leading-none text-ink-faint hover:text-stop">×</button>
                  </div>
                </li>
              ))}
            </ul>}
      </section>

      <section className="mt-8">
        <h2 className="eyebrow">Robux</h2>
        <div className="mt-3 border-t border-line pt-4">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="tnum text-ink-soft">{t.rbx.toLocaleString()} of {NEED.toLocaleString()}</span>
            <span className="tnum font-medium">${(t.rbx * RATE).toFixed(2)}</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-acc transition-[width] duration-700"
                 style={{ width: `${Math.max(pct, t.rbx > 0 ? 1.5 : 0)}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-ink-faint">
            30,000 is the cash-out line. Check it&rsquo;s still that before counting on it.
          </p>
        </div>
        {s.robux.length > 0 && (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {[...s.robux].reverse().map((x: any) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium">{x.what}</div>
                  <div className="text-[12.5px] text-ink-faint">{x.date}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`tnum text-[15px] font-medium ${x.inn ? "text-gain" : "text-stop"}`}>
                    {x.inn ? `+${x.inn}` : `-${x.out}`}
                  </span>
                  <button onClick={() => run(() => removeRobux(x.id))} aria-label="Remove"
                          className="text-[17px] leading-none text-ink-faint hover:text-stop">×</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SaleSheet open={sale} onClose={() => setSale(false)}
        onSave={(p: string, u: number, pr: number, c: number) => {
          setSale(false);
          run(async () => {
            const r: any = await addSale(p, u, pr, c);
            const lines = (r?.moments || []).map((m: any) => m.line);
            if (lines.length) { setNotes?.(lines); setTab?.("now"); }
          }, "Logged");
        }} />
      <RobuxSheet open={rbx} onClose={() => setRbx(false)}
        onSave={(w: string, i: number, o: number) => { setRbx(false); run(() => addRobux(w, i, o), "Logged"); }} />
    </>
  );
}

function SaleSheet({ open, onClose, onSave }: any) {
  const [p, setP] = useState(""); const [u, setU] = useState("1");
  const [pr, setPr] = useState(""); const [c, setC] = useState("");
  useEffect(() => { if (open) { setP(""); setU("1"); setPr(""); setC(""); } }, [open]);
  const profit = (+u || 0) * ((+pr || 0) - (+c || 0));
  return (
    <Sheet open={open} onClose={onClose} title="Add a sale">
      <input className="field" autoFocus value={p} onChange={e => setP(e.target.value)} placeholder="what did you sell" />
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {([["How many", u, setU, "1"], ["Price each", pr, setPr, "4.00"], ["Cost each", c, setC, "0.90"]] as const).map(
          ([lab, val, set, ph]: any) => (
            <div key={lab}>
              <label className="mb-1.5 block text-[11.5px] text-ink-faint">{lab}</label>
              <input className="field px-3 py-2.5 tnum" inputMode="decimal" value={val}
                     onChange={e => set(e.target.value)} placeholder={ph} />
            </div>
          ))}
      </div>
      {profit > 0 && (
        <p className="tnum mt-4 text-center text-[15px] font-medium text-gain">You keep ${profit.toFixed(2)}</p>
      )}
      <Btn kind="primary" className="mt-4" onClick={() => p.trim() && onSave(p, +u, +pr, +c)}>Add</Btn>
    </Sheet>
  );
}

function RobuxSheet({ open, onClose, onSave }: any) {
  const [w, setW] = useState(""); const [i, setI] = useState(""); const [o, setO] = useState("");
  useEffect(() => { if (open) { setW(""); setI(""); setO(""); } }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="Add Robux">
      <input className="field" autoFocus value={w} onChange={e => setW(e.target.value)} placeholder="what happened" />
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div>
          <label className="mb-1.5 block text-[11.5px] text-ink-faint">In</label>
          <input className="field tnum px-3 py-2.5" inputMode="numeric" value={i} onChange={e => setI(e.target.value)} placeholder="35" />
        </div>
        <div>
          <label className="mb-1.5 block text-[11.5px] text-ink-faint">Out</label>
          <input className="field tnum px-3 py-2.5" inputMode="numeric" value={o} onChange={e => setO(e.target.value)} placeholder="0" />
        </div>
      </div>
      <Btn kind="primary" className="mt-4" onClick={() => w.trim() && onSave(w, +i, +o)}>Add</Btn>
    </Sheet>
  );
}

/* ============================================================ PROMPTS
   Was a static deck of nine cards that knew nothing about him. Now generated
   from his plan, profile, ledger and current mission — and regenerable, because
   what's useful changes as he does. The static deck remains the fallback for a
   kid we know nothing about yet. */
function Kit({ s, say, run, pending }: any) {
  const [open, setOpen] = useState<number | null>(null);
  const asked = useRef(false);
  const cards = s.deck?.length ? s.deck : DECK;
  const personal = !!s.deck?.length;

  // Generate once, the first time he opens this tab with something to go on.
  // Deliberate navigation, not a page load.
  useEffect(() => {
    if (asked.current || personal || !s.plan) return;
    asked.current = true;
    run(async () => { await generateDeck(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = (txt: string) =>
    navigator.clipboard?.writeText(txt).then(() => say("Copied")).catch(() => say("Copy failed"));

  const refresh = () => run(async () => {
    const r = await generateDeck();
    say(r?.error ? r.error : "Rewritten around what you're doing now.");
  });

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em]">Prompts</h1>
          <p className="mt-1.5 text-[14.5px] text-ink-soft">
            {personal
              ? "Written around what you're building. Copy, paste, change the brackets."
              : "Copy it, paste it, change the brackets."}
          </p>
        </div>
        {s.plan && (
          <button onClick={refresh} disabled={pending}
                  className="mt-1 flex-none rounded-pill border border-line-strong px-3 py-1.5 text-[12.5px] text-ink-soft transition hover:border-ink/30 hover:text-ink disabled:opacity-40">
            {pending ? "…" : personal ? "Redo these" : "Make these mine"}
          </button>
        )}
      </div>

      <p className="mt-4 rounded-[12px] border border-line bg-surface p-4 text-[14px] leading-relaxed text-ink-soft">
        You&rsquo;ll need one AI chat open next to this. Gemini or ChatGPT, either
        works — whichever you already have.
      </p>

      {pending && !personal && (
        <p className="mt-4 text-[14px] text-ink-faint">Writing these around what you&rsquo;re doing…</p>
      )}

      <div className="mt-6 divide-y divide-line border-y border-line">
        {cards.map((p: any, i: number) => (
          <div key={i} className="py-4">
            <div className="eyebrow">{p.tag}</div>
            <h3 className="mt-1.5 text-[15.5px] font-medium">{p.h}</h3>
            <p className={`mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft
                           ${open === i ? "" : "line-clamp-2"}`}>{p.b}</p>
            <div className="mt-3 flex gap-2">
              <Btn kind="quiet" className="!w-auto !px-4 !py-1.5 !text-[13px]" onClick={() => copy(p.b)}>Copy</Btn>
              <Btn kind="quiet" className="!w-auto !px-4 !py-1.5 !text-[13px]" onClick={() => setOpen(open === i ? null : i)}>
                {open === i ? "Less" : "More"}
              </Btn>
            </div>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="eyebrow">Four habits</h2>
        <ul className="mt-3 space-y-2 text-[14.5px] text-ink-soft">
          <li>Ask for the plan before the code.</li>
          <li>Ask why, not just for the fix.</li>
          <li>Give it your real situation, not a generic one.</li>
          <li>Ask it to argue with you.</li>
        </ul>
      </section>
    </>
  );
}
