"use client";
import { useState } from "react";
import { evaluate } from "@/lib/expr";
import type { Tool } from "@/lib/state";

/* Spec 02 renderers. One component per kind, all fixed code — nothing here is
   generated, so it is testable once and forever. A malformed spec breaks one
   card, never the app. */

const fmt = (v: number | null, format: string) => {
  if (v === null) return "—";                       // unparseable or div-by-zero
  if (format === "money") return `$${v.toFixed(2)}`;
  if (format === "percent") return `${(v * 100).toFixed(0)}%`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

export function ToolCard({ tool, onDelete, onValues, onToggle }: {
  tool: Tool;
  onDelete: () => void;
  onValues: (v: Record<string, number | string>) => void;
  onToggle: (i: number) => void;
}) {
  return (
    <section className="card mt-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[16px] font-semibold tracking-[-0.01em]">{tool.title}</h3>
          {tool.why && <p className="mt-1 text-[13.5px] leading-snug text-ink-soft">{tool.why}</p>}
        </div>
        <button onClick={onDelete} aria-label="Delete this tool"
                className="-m-1 flex-none p-1 text-[17px] leading-none text-ink-faint hover:text-stop">×</button>
      </div>

      {tool.kind === "calc" && <Calc tool={tool} onValues={onValues} />}
      {tool.kind === "checklist" && <Checklist tool={tool} onToggle={onToggle} />}
      {tool.kind === "tracker" && <Tracker tool={tool} />}
      {tool.kind === "reference" && <Reference tool={tool} />}

      {tool.note && <p className="mt-3 text-[12.5px] leading-snug text-ink-faint">{tool.note}</p>}
    </section>
  );
}

function Calc({ tool, onValues }: { tool: Tool; onValues: (v: Record<string, number | string>) => void }) {
  const initial: Record<string, string> = {};
  for (const i of tool.inputs || []) initial[i.key] = String(tool.values?.[i.key] ?? i.default ?? "");
  const [vals, setVals] = useState(initial);

  // Outputs recompute on keystroke. No submit button.
  const nums: Record<string, number> = {};
  for (const i of tool.inputs || []) {
    const n = Number(vals[i.key]);
    if (Number.isFinite(n)) nums[i.key] = n;
  }

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {(tool.inputs || []).map(i => (
          <label key={i.key} className="block">
            <span className="text-[11.5px] text-ink-faint">{i.label}</span>
            <div className="mt-1 flex items-center gap-1">
              {i.prefix && <span className="text-[14px] text-ink-faint">{i.prefix}</span>}
              <input
                className="field tnum px-3 py-2"
                inputMode={i.type === "number" ? "decimal" : "text"}
                value={vals[i.key] ?? ""}
                onChange={e => {
                  const next = { ...vals, [i.key]: e.target.value };
                  setVals(next);
                  onValues(next);
                }} />
              {i.suffix && <span className="text-[13px] text-ink-faint">{i.suffix}</span>}
            </div>
          </label>
        ))}
      </div>

      <dl className="mt-4 divide-y divide-line border-t border-line">
        {(tool.outputs || []).map((o, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-[14px] text-ink-soft">{o.label}</dt>
            <dd className="tnum font-display text-[18px] font-semibold">
              {fmt(evaluate(o.expr, nums), o.format)}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function Checklist({ tool, onToggle }: { tool: Tool; onToggle: (i: number) => void }) {
  return (
    <ul className="mt-3 space-y-1">
      {(tool.items || []).map((it, i) => (
        <li key={i}>
          <button onClick={() => onToggle(i)} aria-pressed={it.done}
            className="group flex w-full items-start gap-2.5 rounded-[8px] px-1 py-1.5 text-left hover:bg-canvas">
            <span className={`mt-[2px] flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] border
                             ${it.done ? "border-gain bg-gain" : "border-line-strong group-hover:border-ink/40"}`}>
              {it.done && (
                <svg width="10" height="10" viewBox="0 0 12 12">
                  <path d="M2.5 6.5 L5 9 L9.5 3.5" stroke="#fff" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
            </span>
            <span className={`text-[14px] leading-snug ${it.done ? "text-ink-faint line-through" : ""}`}>{it.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Tracker({ tool }: { tool: Tool }) {
  const target = tool.target || 1;
  const current = tool.current || 0;
  const pct = Math.min(100, (current / target) * 100);
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="tnum text-ink-soft">
          {current.toLocaleString()} of {target.toLocaleString()}{tool.unit ? ` ${tool.unit}` : ""}
        </span>
        <span className="tnum font-medium">{pct.toFixed(0)}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-acc transition-[width] duration-700"
             style={{ width: `${Math.max(pct, current > 0 ? 1.5 : 0)}%` }} />
      </div>
    </div>
  );
}

function Reference({ tool }: { tool: Tool }) {
  return (
    <dl className="mt-3 divide-y divide-line border-t border-line">
      {(tool.rows || []).map((r, i) => (
        <div key={i} className="flex gap-4 py-2">
          <dt className="w-[45%] flex-none text-[13.5px] text-ink-soft">{r.k}</dt>
          <dd className="text-[13.5px]">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}
