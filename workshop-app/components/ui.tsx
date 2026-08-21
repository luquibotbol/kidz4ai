"use client";
import React, { useEffect, useRef, useState } from "react";

/* ---------------- Button ----------------
   Literal class strings on purpose. Tailwind scans source text, so a
   constructed name like `btn-${kind}` gets tree-shaken away. */
const KIND = {
  primary: "btn btn-primary",
  accent: "btn btn-accent",
  quiet: "btn btn-quiet",
} as const;

export function Btn({
  kind = "primary", children, className = "", ...p
}: { kind?: keyof typeof KIND } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={`${KIND[kind]} ${className}`}>{children}</button>;
}

/* ---------------- Mark ----------------
   Replaces the robot mascot. A 13-year-old already running a business reads a
   bouncing cartoon as a kids' app. Three states, drawn not animated. */
export function Mark({ state = "idle", size = 28 }: { state?: "idle" | "on" | "done"; size?: number }) {
  const fill = state === "done" ? "#0B7A55" : state === "on" ? "#2340E8" : "#14151A";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="8" fill={fill} />
      <path d="M10 16.5 L14.5 21 L22 12" stroke="#fff" strokeWidth="2.6"
            strokeLinecap="round" strokeLinejoin="round" fill="none"
            opacity={state === "done" ? 1 : 0} />
      <circle cx="16" cy="16" r="3.2" fill="#fff" opacity={state === "done" ? 0 : 1} />
    </svg>
  );
}

/* ---------------- Count-up number ---------------- */
export function Count({ to, prefix = "", suffix = "", decimals = 0 }:
  { to: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [v, setV] = useState(to);
  const prev = useRef(to);
  useEffect(() => {
    const from = prev.current; prev.current = to;
    if (from === to) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    const t0 = performance.now(), dur = 520;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setV(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{prefix}{v.toFixed(decimals)}{suffix}</>;
}

/* ---------------- Scoreboard figure ---------------- */
export function Score({ v, k, tone = "ink" }:
  { v: React.ReactNode; k: string; tone?: "ink" | "acc" | "gain" }) {
  const c = { ink: "text-ink", acc: "text-acc", gain: "text-gain" }[tone];
  return (
    <div className="min-w-0 flex-1 px-2.5 py-1 first:pl-0 last:pr-0">
      <div className={`tnum truncate font-display text-[clamp(21px,6.4vw,28px)] font-semibold leading-none tracking-[-0.03em] ${c}`}>
        {v}
      </div>
      <div className="eyebrow mt-2">{k}</div>
    </div>
  );
}

/* ---------------- Confetti ----------------
   Fires on a real ship and nowhere else. Non-contingent juice measured
   beta = -0.43 on perceived competence (Kao, CHI 2024). */
export function Confetti({ on }: { on: boolean }) {
  if (!on) return null;
  const cols = ["#2340E8", "#0B7A55", "#A8500A", "#14151A"];
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 26 }).map((_, i) => (
        <i key={i} style={{
          left: `${6 + (i * 3.5) % 88}%`,
          background: cols[i % cols.length],
          animationDelay: `${(i % 7) * 40}ms`,
          transform: `rotate(${i * 37}deg)`,
        }} />
      ))}
    </div>
  );
}

/* ---------------- Sheet ---------------- */
export function Sheet({ open, onClose, title, children }:
  { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/30 backdrop-blur-[2px] animate-fadein sm:items-center sm:p-5"
         onClick={onClose} role="dialog" aria-modal aria-label={title}>
      {/* Capped and scrollable. Without a max height, tall content (Settings is
          the worst) grows past the viewport and — because this is bottom
          anchored — pushes the header and its close button off the top of the
          screen, with no way out on a phone. */}
      <div className="flex max-h-[85dvh] w-full max-w-[520px] flex-col rounded-t-[18px]
                      border border-line bg-surface sm:max-h-[80dvh] sm:rounded-[18px]"
           onClick={e => e.stopPropagation()}>
        <div className="flex flex-none items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
          <button onClick={onClose} aria-label="Close"
                  className="-m-2 flex h-9 w-9 items-center justify-center p-2 text-[22px] leading-none text-ink-faint hover:text-ink">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4
                        pb-[calc(20px+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Toast ---------------- */
export function Toast({ msg }: { msg: string | null }) {
  return (
    <div aria-live="polite"
         className={`pointer-events-none fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-pill
                     bg-ink px-4 py-2.5 text-[13px] font-medium text-white transition-all duration-200
                     ${msg ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
      {msg}
    </div>
  );
}

/* ---------------- Draggable floating button ----------------
   Drag it anywhere; the position sticks per device. A short press is still a
   tap — movement under DRAG_SLOP counts as a click, so it never opens by
   accident mid-drag, and never refuses to open because a finger wobbled. */
const DRAG_SLOP = 6;
const SIZE = 44;
const EDGE = 10;
const STORE = "k4_note_pos";

export function DragButton({
  onPress, label, children,
}: { onPress: () => void; label: string; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const g = useRef({ on: false, moved: false, dx: 0, dy: 0, x0: 0, y0: 0 });
  const live = useRef<{ x: number; y: number } | null>(null);   // current pos, for saving

  /* A viewport of 0 happens transiently — a hidden tab, a phone mid-rotation.
     Clamping against it would squash the button into the corner and, worse,
     persist that. So when the window has no size, leave the position alone. */
  const clamp = (x: number, y: number) => {
    const w = window.innerWidth, h = window.innerHeight;
    if (w < SIZE * 2 || h < SIZE * 2) return { x, y };
    return {
      x: Math.min(Math.max(EDGE, x), w - SIZE - EDGE),
      y: Math.min(Math.max(EDGE, y), h - SIZE - 72),   // clear of the tab bar
    };
  };

  const place = (p: { x: number; y: number }) => { live.current = p; setPos(p); };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) { const p = JSON.parse(raw); if (typeof p?.x === "number") place(clamp(p.x, p.y)); }
    } catch { /* first run, or storage blocked */ }
    // Re-clamp on resize so it can't strand off-screen, but never persist that.
    const onResize = () => { if (live.current) place(clamp(live.current.x, live.current.y)); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <button
      aria-label={label}
      title="Drag to move"
      onPointerDown={e => {
        const r = e.currentTarget.getBoundingClientRect();
        g.current = { on: true, moved: false, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        if (!g.current.on) return;
        const far = Math.hypot(e.clientX - g.current.x0, e.clientY - g.current.y0) > DRAG_SLOP;
        if (!far && !g.current.moved) return;
        g.current.moved = true;
        setDragging(true);
        place(clamp(e.clientX - g.current.dx, e.clientY - g.current.dy));
      }}
      onPointerUp={() => {
        const wasDrag = g.current.moved;
        g.current.on = false;
        setDragging(false);
        if (wasDrag) {
          // Persist explicitly. Never do this inside a state updater.
          try { if (live.current) localStorage.setItem(STORE, JSON.stringify(live.current)); } catch {}
        } else {
          onPress();
        }
      }}
      onPointerCancel={() => { g.current.on = false; setDragging(false); }}
      className={`fixed z-[55] flex h-11 w-11 touch-none select-none items-center justify-center
                  rounded-full border border-line-strong bg-surface text-ink
                  shadow-[0_2px_10px_rgba(0,0,0,.07)]
                  ${dragging ? "scale-110 cursor-grabbing shadow-[0_6px_18px_rgba(0,0,0,.16)]" : "cursor-grab transition hover:border-ink/30 active:scale-95"}`}
      style={pos
        ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
        : { right: "max(16px, calc(50% - 260px))", bottom: 76 }}
    >
      {children}
    </button>
  );
}

/* ---------------- Rich text ----------------
   The model writes markdown; the chat was showing the asterisks. This renders
   the subset it actually uses.

   Deliberately NOT dangerouslySetInnerHTML and NOT a markdown library: this
   renders text a 13-year-old pastes back and forth with an AI, so it builds
   React nodes only. There is no path from message content to raw HTML. */
const INLINE = /(\*\*(?!\s)[^*\n]+(?<!\s)\*\*|__(?!\s)[^_\n]+(?<!\s)__|`[^`\n]+`|\*(?!\s)[^*\n]+(?<!\s)\*|(?<![a-zA-Z0-9])_(?!\s)[^_\n]+(?<!\s)_(?![a-zA-Z0-9]))/g;

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null, i = 0;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${keyBase}-${i++}`;
    if (t.startsWith("**") || t.startsWith("__")) {
      out.push(<strong key={k} className="font-semibold">{t.slice(2, -2)}</strong>);
    } else if (t.startsWith("`")) {
      out.push(<code key={k} className="rounded bg-canvas px-1 py-0.5 font-mono text-[0.92em]">{t.slice(1, -1)}</code>);
    } else {
      out.push(<em key={k}>{t.slice(1, -1)}</em>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Rich({ text }: { text: string }) {
  // Lines are kept as lines — the container uses whitespace-pre-wrap, so the
  // structure of lists and paragraphs survives without extra <br> tags.
  const lines = (text || "").split("\n");
  return (
    <>
      {lines.map((line, i) => {
        // "### Heading" -> bold line. The model occasionally emits these.
        const h = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
        const body = h ? <strong className="font-semibold">{inline(h[1], `h${i}`)}</strong> : inline(line, `l${i}`);
        return <React.Fragment key={i}>{i > 0 ? "\n" : null}{body}</React.Fragment>;
      })}
    </>
  );
}


/* ---------------- The moment ----------------
   Spec 12. Success-contingent feedback is the strongest lever available
   (Kao: +0.45; non-contingent "juice" measures -0.43), so this appears ONLY
   after he has actually made something. It is dismissible, it never appears
   twice for the same reason, and there is no list of these to go and collect —
   the moment a reward is expected it flips from +0.01 to -0.44 (Deci). */
export function ShipMoment({
  title, made, seenBy, days, lines, tease, onClose,
}: {
  title: string; made: number; seenBy: number; days: number;
  lines: string[]; tease?: string; onClose: () => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 40); return () => clearTimeout(t); }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-canvas/95 px-6 backdrop-blur-sm animate-fadein"
         role="dialog" aria-modal onClick={onClose}>
      <div className="w-full max-w-[420px]" onClick={e => e.stopPropagation()}>
        <div className="eyebrow">That exists now</div>

        <h1 className="mt-3 font-display text-[27px] font-semibold leading-[1.12] tracking-[-0.025em]">
          {title}
        </h1>

        <div className="mt-7 flex divide-x divide-line border-y border-line py-4">
          {([[String(made), made === 1 ? "thing made" : "things made"],
             [String(seenBy), "saw it"],
             [String(days), days === 1 ? "day" : "days"]] as const).map(([v, k], i) => (
            <div key={k} className="min-w-0 flex-1 px-2.5 first:pl-0 last:pr-0"
                 style={{ transform: shown ? "translateY(0)" : "translateY(10px)",
                          opacity: shown ? 1 : 0,
                          transition: `all .45s cubic-bezier(.2,.8,.3,1) ${i * 90}ms` }}>
              <div className="tnum font-display text-[28px] font-semibold leading-none">{v}</div>
              <div className="eyebrow mt-2">{k}</div>
            </div>
          ))}
        </div>

        {/* The unexpected part. Never promised, never repeated. */}
        {lines.map((line, i) => (
          <p key={i} className="mt-4 text-[15.5px] leading-relaxed"
             style={{ opacity: shown ? 1 : 0, transition: `opacity .5s ease ${350 + i * 180}ms` }}>
            {line}
          </p>
        ))}

        {tease && (
          <p className="mt-5 text-[14.5px] leading-relaxed text-ink-soft"
             style={{ opacity: shown ? 1 : 0, transition: "opacity .5s ease 700ms" }}>
            {tease}
          </p>
        )}

        <Btn kind="primary" className="mt-8" onClick={onClose}>Done</Btn>
      </div>
    </div>
  );
}

/* A quieter version for moments that arrive outside a ship — a sale, a reach
   update, the prediction coming true. Same rules. */
export function MomentNote({ lines, onClose }: { lines: string[]; onClose: () => void }) {
  if (!lines.length) return null;
  return (
    <div className="card mt-6 animate-rise border-gain/40 bg-gain-wash p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          {lines.map((l, i) => <p key={i} className="text-[15px] leading-relaxed">{l}</p>)}
        </div>
        <button onClick={onClose} aria-label="Dismiss"
                className="-m-1 flex-none p-1 text-[17px] leading-none text-ink-faint hover:text-ink">×</button>
      </div>
    </div>
  );
}
