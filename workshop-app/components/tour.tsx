"use client";
import { useEffect, useState } from "react";
import { Btn, Mark } from "./ui";

/* Item 5 — the short walkthrough. Four cards, animated only enough to show
   what each screen is for. Skippable on every card, shown once, never again.
   Motion is transform/opacity only and respects prefers-reduced-motion. */

const CARDS = [
  {
    title: "I'm your mentor for this",
    body: "You're going to make real things — games people play, designs people buy. I work out what's worth making next, and I stay with you while you build it.",
    art: "mission",
  },
  {
    title: "I know how this usually goes",
    body: "I'll tell you the part that trips everyone up before you get there. So when you hit it, you'll know you're on track — not that you're doing it wrong.",
    art: "day",
  },
  {
    title: "You build it somewhere else",
    body: "Roblox Studio, Canva, your own AI chat. Tap a step and it hands you the exact thing to paste.",
    art: "bridge",
  },
  {
    title: "This is the scoreboard",
    body: "What you made. How many people outside your family saw it. What you kept. That's the whole score.",
    art: "score",
  },
] as const;

function Art({ kind, on }: { kind: string; on: boolean }) {
  const base = "transition-all duration-500 ease-out";
  if (kind === "mission") {
    return (
      <div className="flex h-[92px] flex-col justify-center gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className={`${base} h-3 rounded-full ${i === 0 ? "bg-ink" : "bg-line"}`}
               style={{ width: on ? (i === 0 ? "72%" : i === 1 ? "46%" : "34%") : "0%",
                        transitionDelay: `${i * 90}ms`, opacity: i === 0 ? 1 : 0.5 }} />
        ))}
      </div>
    );
  }
  if (kind === "day") {
    return (
      <div className="flex h-[92px] items-center gap-2.5">
        {[1, 2, 3, 4].map(d => (
          <div key={d}
            className={`${base} flex h-11 w-11 items-center justify-center rounded-[10px] text-[15px] font-semibold
                        ${d === 2 ? "bg-flag-wash text-flag" : "bg-canvas text-ink-faint"}`}
            style={{ transform: on ? "translateY(0)" : "translateY(10px)", opacity: on ? 1 : 0,
                     transitionDelay: `${d * 70}ms` }}>
            {d}
          </div>
        ))}
      </div>
    );
  }
  if (kind === "bridge") {
    return (
      <div className="flex h-[92px] items-center gap-3">
        <div className="h-11 w-11 flex-none rounded-[10px] bg-ink" />
        <div className={`${base} h-[2px] flex-1 bg-line-strong`}
             style={{ transform: on ? "scaleX(1)" : "scaleX(0)", transformOrigin: "left" }} />
        <div className={`${base} h-11 w-11 flex-none rounded-[10px] border-2 border-dashed border-line-strong`}
             style={{ opacity: on ? 1 : 0, transitionDelay: "260ms" }} />
      </div>
    );
  }
  return (
    <div className="flex h-[92px] items-end gap-5">
      {[["3", "Made"], ["61", "Saw it"], ["$58", "Kept"]].map(([v, k], i) => (
        <div key={k} className={base}
             style={{ transform: on ? "translateY(0)" : "translateY(12px)", opacity: on ? 1 : 0,
                      transitionDelay: `${i * 110}ms` }}>
          <div className="tnum font-display text-[26px] font-semibold leading-none">{v}</div>
          <div className="eyebrow mt-1.5">{k}</div>
        </div>
      ))}
    </div>
  );
}

export function Tour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [on, setOn] = useState(false);
  const card = CARDS[i];
  const last = i === CARDS.length - 1;

  // Re-trigger the art each time the card changes.
  useEffect(() => { setOn(false); const t = setTimeout(() => setOn(true), 30); return () => clearTimeout(t); }, [i]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-6 py-10">
      <Mark size={26} />
      <div className="mt-7">
        <Art kind={card.art} on={on} />
      </div>

      <h1 key={card.title}
          className="mt-7 animate-rise font-display text-[24px] font-semibold leading-tight tracking-[-0.025em]">
        {card.title}
      </h1>
      <p key={card.body} className="mt-3 animate-rise text-[15.5px] leading-relaxed text-ink-soft">
        {card.body}
      </p>

      <div className="mt-8 flex items-center gap-2">
        {CARDS.map((_, n) => (
          <span key={n} className={`h-1.5 rounded-full transition-all duration-300 ${n === i ? "w-5 bg-ink" : "w-1.5 bg-line-strong"}`} />
        ))}
      </div>

      <Btn kind="primary" className="mt-5" onClick={() => (last ? onDone() : setI(i + 1))}>
        {last ? "Start the questions" : "Next"}
      </Btn>
      <button onClick={onDone}
              className="mx-auto mt-4 text-[13px] text-ink-faint underline underline-offset-4 hover:text-ink-soft">
        Skip
      </button>
    </main>
  );
}
