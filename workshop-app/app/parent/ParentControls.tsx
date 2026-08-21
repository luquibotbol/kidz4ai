"use client";
import { useState, useTransition } from "react";
import { saveKit, answerRequest } from "../actions";
import { Btn } from "@/components/ui";
import type { Kit, Request } from "@/lib/state";

export default function ParentControls({
  canEdit, kit, pending, answered,
}: { canEdit: boolean; kit: Kit; pending: Request[]; answered: Request[] }) {
  const [k, setK] = useState<Kit>(kit);
  const [note, setNote] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [busy, start] = useTransition();

  const field = (label: string, node: React.ReactNode) => (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-1.5">{node}</div>
    </label>
  );

  return (
    <>
      {/* Requests first — they are the thing that is actually waiting on him. */}
      <section className="mt-9">
        <h2 className="eyebrow">Requests {pending.length > 0 && `(${pending.length} waiting)`}</h2>
        {pending.length === 0 && answered.length === 0 && (
          <p className="mt-3 border-t border-line py-5 text-[14px] text-ink-faint">
            None. The AI asks here when a mission needs something he doesn&rsquo;t have.
            It always names what he does in the meantime, so he is never waiting on you.
          </p>
        )}

        {pending.map(r => (
          <div key={r.id} className="card mt-3 border-acc/40 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15.5px] font-medium">{r.what}</p>
              <span className="tnum flex-none rounded-pill bg-canvas px-2.5 py-1 text-[12px]">
                {r.cost > 0 ? `$${r.cost.toFixed(2)}` : "free"}
              </span>
            </div>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{r.why}</p>
            <p className="mt-3 rounded-[10px] bg-canvas p-3 text-[13.5px] leading-snug">
              <span className="font-medium">If you say no:</span> {r.workaround}
            </p>
            {k.monthlyBudget > 0 && r.cost > k.monthlyBudget && (
              <p className="mt-2 text-[13px] text-flag">
                Over the ${k.monthlyBudget}/mo you set. Your call.
              </p>
            )}
            {canEdit && (
              <>
                <input value={note[r.id] || ""} onChange={e => setNote({ ...note, [r.id]: e.target.value })}
                  className="field mt-3" placeholder="optional note back, e.g. yes but $5 cap" />
                <div className="mt-3 flex gap-2.5">
                  <Btn kind="primary" disabled={busy}
                       onClick={() => start(() => answerRequest(r.id, "approved", note[r.id]).then())}>
                    Approve
                  </Btn>
                  <Btn kind="quiet" disabled={busy}
                       onClick={() => start(() => answerRequest(r.id, "declined", note[r.id]).then())}>
                    Decline
                  </Btn>
                </div>
                <p className="mt-2.5 text-[12.5px] leading-snug text-ink-faint">
                  Declining is not a failure. He is routed to the workaround and
                  never told you said no.
                </p>
              </>
            )}
          </div>
        ))}

        {answered.length > 0 && (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {answered.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-[14px] text-ink-soft">{r.what}</span>
                <span className={`flex-none text-[12.5px] ${r.status === "approved" ? "text-gain" : "text-ink-faint"}`}>
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The Kit — the highest-value, lowest-effort thing on this page. */}
      <section className="mt-9">
        <h2 className="eyebrow">What he actually has</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
          Missions that need something he doesn&rsquo;t have are the main reason
          missions die. Fill this in once.
        </p>

        <div className="card mt-3 space-y-4 p-5">
          {field("Device", <input className="field" value={k.device}
            onChange={e => setK({ ...k, device: e.target.value })}
            placeholder="old MacBook Air, shared" />)}

          {field("Accounts he already has", <input className="field" value={k.accounts.join(", ")}
            onChange={e => setK({ ...k, accounts: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })}
            placeholder="Roblox, ChatGPT (my login), Canva free" />)}

          {field("Email he controls", <input className="field" value={k.hasEmail || ""}
            onChange={e => setK({ ...k, hasEmail: e.target.value || null })}
            placeholder="leave blank if none" />)}

          {field("How you'd pay", <input className="field" value={k.payment || ""}
            onChange={e => setK({ ...k, payment: e.target.value || null })}
            placeholder="my PayPal, I approve each one" />)}

          {field("Printer", <input className="field" value={k.printer || ""}
            onChange={e => setK({ ...k, printer: e.target.value || null })}
            placeholder="3D printer at home / none" />)}

          <div className="grid grid-cols-2 gap-3">
            {field("$ per month, no asking", <input className="field tnum" inputMode="decimal"
              value={String(k.monthlyBudget)}
              onChange={e => setK({ ...k, monthlyBudget: Number(e.target.value) || 0 })} />)}
            {field("Hours per week (real)", <input className="field tnum" inputMode="decimal"
              value={String(k.hoursPerWeek)}
              onChange={e => setK({ ...k, hoursPerWeek: Number(e.target.value) || 0 })} />)}
          </div>

          <div className="flex gap-5">
            {([["phone", "Has a phone"], ["canReceiveMail", "Can receive mail"]] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" checked={!!k[key]}
                  onChange={e => setK({ ...k, [key]: e.target.checked })}
                  className="h-4 w-4 accent-[#2340E8]" />
                {label}
              </label>
            ))}
          </div>

          {field("Anything else", <textarea rows={2} className="field resize-none" value={k.notes}
            onChange={e => setK({ ...k, notes: e.target.value })}
            placeholder="no Discord, school laptop is locked down" />)}

          {canEdit ? (
            <Btn kind="primary" disabled={busy}
                 onClick={() => start(() => saveKit(k).then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }))}>
              {busy ? "Saving…" : saved ? "Saved" : "Save"}
            </Btn>
          ) : (
            <p className="text-[13px] text-ink-faint">
              You can see this, but only the parent account can change it.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
