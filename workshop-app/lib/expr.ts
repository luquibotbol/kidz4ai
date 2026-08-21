/* ------------------------------------------------------------------
   A tiny arithmetic evaluator: tokenize -> shunting-yard -> evaluate.

   There is no eval, no new Function, no template execution, and there never
   will be. The AI generates a declarative spec; THIS file is fixed, hand
   written and tested, so a bad generation breaks one card instead of the app.

   Anything it cannot parse returns null, which the UI renders as an em dash.
------------------------------------------------------------------- */

type Tok = { t: "num"; v: number } | { t: "id"; v: string }
         | { t: "op"; v: string } | { t: "fn"; v: string }
         | { t: "("; } | { t: ")"; } | { t: ","; };

const FNS: Record<string, (...a: number[]) => number> = {
  min: Math.min, max: Math.max, round: Math.round,
  ceil: Math.ceil, floor: Math.floor, abs: Math.abs,
};

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

function tokenize(src: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+/.exec(src.slice(i));
      if (!m) return null;
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      const name = m[0];
      i += name.length;
      // A name immediately followed by "(" is a function call.
      if (src[i] === "(" && name in FNS) out.push({ t: "fn", v: name });
      else if (name in FNS) return null;           // bare function name
      else out.push({ t: "id", v: name });
      continue;
    }
    if ("+-*/".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    if (c === "(") { out.push({ t: "(" }); i++; continue; }
    if (c === ")") { out.push({ t: ")" }); i++; continue; }
    if (c === ",") { out.push({ t: "," }); i++; continue; }
    return null;                                    // anything else is invalid
  }
  return out;
}

/** Every identifier the expression depends on — used to validate a generated
    tool before it is ever saved. */
export function identifiers(src: string): string[] | null {
  const toks = tokenize(src);
  if (!toks) return null;
  return [...new Set(toks.filter((t): t is { t: "id"; v: string } => t.t === "id").map(t => t.v))];
}

export function evaluate(src: string, vars: Record<string, number> = {}): number | null {
  const toks = tokenize(src);
  if (!toks || !toks.length) return null;

  const vals: number[] = [];
  const ops: Tok[] = [];
  const argc: number[] = [];

  const apply = (): boolean => {
    const op = ops.pop();
    if (!op) return false;
    if (op.t === "fn") {
      const n = argc.pop() ?? 1;
      if (vals.length < n) return false;
      const args = vals.splice(vals.length - n, n);
      const r = FNS[op.v](...args);
      if (!Number.isFinite(r)) return false;
      vals.push(r);
      return true;
    }
    if (op.t !== "op") return false;
    if (vals.length < 2) return false;
    const b = vals.pop()!, a = vals.pop()!;
    if (op.v === "/" && b === 0) return false;      // never Infinity, never NaN
    const r = op.v === "+" ? a + b : op.v === "-" ? a - b : op.v === "*" ? a * b : a / b;
    if (!Number.isFinite(r)) return false;
    vals.push(r);
    return true;
  };

  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    const prev = toks[k - 1];
    if (tok.t === "num") { vals.push(tok.v); continue; }
    if (tok.t === "id") {
      const v = vars[tok.v];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;  // unknown key
      vals.push(v); continue;
    }
    if (tok.t === "fn") { ops.push(tok); argc.push(1); continue; }
    if (tok.t === "(") { ops.push(tok); continue; }
    if (tok.t === ",") {
      while (ops.length && ops[ops.length - 1].t !== "(") if (!apply()) return null;
      if (!argc.length) return null;          // a comma outside any call
      argc[argc.length - 1]++;                // one more argument for this fn
      continue;
    }
    if (tok.t === ")") {
      while (ops.length && ops[ops.length - 1].t !== "(") if (!apply()) return null;
      if (!ops.length) return null;                 // unbalanced
      ops.pop();                                    // the "("
      if (ops.length && ops[ops.length - 1].t === "fn") { if (!apply()) return null; }
      continue;
    }
    // operator — unary minus becomes 0 - x
    if (tok.t === "op") {
      const unary = tok.v === "-" && (k === 0 || (prev && (prev.t === "op" || prev.t === "(" || prev.t === ",")));
      if (unary) {
        // 0 - x, and crucially do NOT pop higher-precedence operators first:
        // in "3 * -2" the * must stay on the stack or it multiplies by the 0.
        vals.push(0);
        ops.push(tok);
        continue;
      }
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t === "op" && PREC[top.v] >= PREC[tok.v]) { if (!apply()) return null; }
        else break;
      }
      ops.push(tok);
      continue;
    }
  }
  while (ops.length) {
    if (ops[ops.length - 1].t === "(") return null; // unbalanced
    if (!apply()) return null;
  }
  if (vals.length !== 1) return null;
  return Number.isFinite(vals[0]) ? vals[0] : null;
}

/** Comma-separated arity for min/max — counted while parsing. */
export function countArgs(src: string): number {
  return (src.match(/,/g) || []).length + 1;
}
