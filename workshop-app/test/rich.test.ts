import { test } from "node:test";
import assert from "node:assert/strict";

/* The regex is the whole risk surface here, so test it directly rather than
   through React. Mirrors INLINE in components/ui.tsx. */
const INLINE = /(\*\*(?!\s)[^*\n]+(?<!\s)\*\*|__(?!\s)[^_\n]+(?<!\s)__|`[^`\n]+`|\*(?!\s)[^*\n]+(?<!\s)\*|(?<![a-zA-Z0-9])_(?!\s)[^_\n]+(?<!\s)_(?![a-zA-Z0-9]))/g;
const toks = (s: string) => { INLINE.lastIndex = 0; return s.match(INLINE) || []; };

test("picks up the formats the model actually emits", () => {
  assert.deepEqual(toks("Export at **2x** from Canva"), ["**2x**"]);
  assert.deepEqual(toks("use `pack.mcmeta` here"), ["`pack.mcmeta`"]);
  assert.deepEqual(toks("that is *not* the same"), ["*not*"]);
  assert.deepEqual(toks("__really__ bold"), ["__really__"]);
});

test("leaves ordinary prose and code-ish text alone", () => {
  assert.deepEqual(toks("no formatting at all"), []);
  assert.deepEqual(toks("2 * 3 * 4"), []);                 // spaced asterisks are maths
  assert.deepEqual(toks("snake_case_name stays plain"), []); // underscores inside words
  assert.deepEqual(toks("a * b"), []);
});

test("does not run across line breaks", () => {
  assert.deepEqual(toks("**start\nend**"), []);
  assert.deepEqual(toks("`open\nclose`"), []);
});

test("handles several on one line, bold before italic", () => {
  assert.deepEqual(toks("**a** and *b* and `c`"), ["**a**", "*b*", "`c`"]);
});

test("an unclosed marker is left as literal text", () => {
  assert.deepEqual(toks("**unclosed"), []);
  assert.deepEqual(toks("half `open"), []);
});
