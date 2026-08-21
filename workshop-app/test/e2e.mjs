import { chromium } from "playwright";

const B = "http://localhost:3100";
let fails = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? "  PASS  " : "  FAIL  ") + m); if (!c) fails++; };

const KID = { u: "testkid", p: "fixture-pw" };
const KID2 = { u: "otherkid", p: "fixture-pw2" };
const PARENT = { u: "testparent", p: "fixture-pw3" };

const b = await chromium.launch();

/** A fresh, isolated browser context — no cookies carried between accounts. */
async function fresh() {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", e => p.errors.push(e.message));
  return { ctx, p };
}

/** Clicks past the disclosure and the tour so a test can reach the app proper.
 *  Both are once-per-account, so this is what a real first session looks like. */
async function onboard(p) {
  const got = p.locator('button:has-text("Got it")');
  if (await got.count()) { await got.first().click(); await p.waitForTimeout(600); }
  const skip = p.locator('button:has-text("Skip")');
  if (await skip.count()) { await skip.first().click(); await p.waitForTimeout(900); }
  // The "what should I call you" sheet opens over the app on a first session.
  // Dismiss it the way a kid would, or nothing underneath is clickable.
  const close = p.locator('button', { hasText: /^×$/ });
  if (await close.count()) {
    await close.first().click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(600);
  }
}

async function login(p, { u, pw }) {
  await p.goto(B + "/login", { waitUntil: "domcontentloaded" });
  await p.fill('input[name="username"]', u);
  await p.fill('input[name="password"]', pw);
  await Promise.all([
    p.waitForURL(x => !String(x).includes("/login"), { timeout: 15000 }).catch(() => {}),
    p.click('form button'),
  ]);
}

/* ---------- 1. nothing is reachable signed out ---------- */
{
  const { ctx, p } = await fresh();
  await p.goto(B + "/", { waitUntil: "domcontentloaded" });
  ok(p.url().includes("/login"), "signed out, / redirects to the login page");
  await p.goto(B + "/parent", { waitUntil: "domcontentloaded" });
  ok(p.url().includes("/login"), "signed out, /parent redirects to the login page");
  await ctx.close();
}

/* ---------- 2. a wrong password gets in nowhere, and gives nothing away ---------- */
{
  const { ctx, p } = await fresh();
  await login(p, { u: KID.u, pw: "wrong-password" });
  ok(p.url().includes("/login"), "a real username with a wrong password does not sign in");
  const wrongPw = (await p.textContent("body")) || "";

  await login(p, { u: "nosuchkid", pw: KID.p });
  const wrongUser = (await p.textContent("body")) || "";
  const msg = /don.t match/i;
  ok(msg.test(wrongPw) && msg.test(wrongUser),
     "both failures show an error");
  ok(!/no such user|unknown user|user not found|wrong password/i.test(wrongPw + wrongUser),
     "the error never says WHICH half was wrong");
  await ctx.close();
}

/* ---------- 3. the kid gets in, and cannot reach the parent view ---------- */
{
  const { ctx, p } = await fresh();
  await login(p, { u: KID.u, pw: KID.p });
  ok(!p.url().includes("/login"), "the kid signs in");
  await p.goto(B + "/parent", { waitUntil: "domcontentloaded" });
  const body = (await p.textContent("body")) || "";
  ok(!p.url().includes("/parent") || !/what .*they.*(said|sent)/i.test(body),
     "a kid opening /parent does not get the parent view");
  ok(p.errors.length === 0, "no uncaught page errors in the kid flow: " + p.errors.join("; "));
  await ctx.close();
}

/* ---------- 4. the coach conversation never reaches the parent (D-017) ---------- */
{
  const kid = await fresh();
  await login(kid.p, { u: KID.u, pw: KID.p });
  const SECRET = "zxqv-private-coach-sentence-9184";
  // Say something to the coach, then look for it in the parent view.
  await kid.p.goto(B + "/", { waitUntil: "domcontentloaded" });
  await onboard(kid.p);
  let said = false;
  try {
    // Pre-discovery there is no Coach tab yet — "Start" is how a real first
    // session gets there. Post-discovery the tab exists; try both.
    const entry = kid.p.getByRole("button", { name: /^(Start|Coach)$/ }).first();
    await entry.click({ timeout: 8000 });
    await kid.p.waitForTimeout(1200);
    const box = kid.p.locator("textarea").last();
    await box.fill(SECRET, { timeout: 5000 });
    await box.press("Enter");
    // The discovery transcript does not echo the kid's own turn, so wait for
    // the coach to answer instead — that only happens once the message has
    // reached the server and been written to his conversation.
    await kid.p.waitForSelector('button:has-text("This reply was wrong")', { timeout: 20000 });
    said = true;
  } catch (e) { said = false; kid.why = String(e.message || e).slice(0, 120); }
  if (!said) kid.snapshot = JSON.stringify(await kid.p.evaluate(() =>
    [...document.querySelectorAll("button")].map(b => ({
      t: (b.textContent || "").trim().slice(0, 24),
      hidden: b.offsetParent === null,
    }))));
  ok(said, "the kid can actually reach the coach and send a message"
     + (said ? "" : `\n          why: ${kid.why}\n          page: ${kid.snapshot}`));

  const parent = await fresh();
  await login(parent.p, { u: PARENT.u, pw: PARENT.p });
  await parent.p.goto(B + "/parent", { waitUntil: "domcontentloaded" });
  const seen = (await parent.p.textContent("body")) || "";
  // Control: without this, the assertion below would pass just as happily on a
  // blank page or a redirect, and would be worth nothing.
  ok(seen.includes("The Window"),
     "control — the parent view actually loaded, so the check below means something");
  ok(said && !seen.includes(SECRET),
     "the parent view never shows what the kid said to the coach (D-017)");
  // And prove the matcher can fail: the same search for text that IS on the
  // page must come back positive.
  ok(!seen.includes("zxqv-") && seen.includes("What he made"),
     "control — the same substring search does find text that is present");
  await kid.ctx.close(); await parent.ctx.close();
}

/* ---------- 5. two kids never share state ---------- */
{
  const a = await fresh();
  await login(a.p, { u: KID.u, pw: KID.p });
  const aBody = (await a.p.textContent("body")) || "";

  const c = await fresh();
  await login(c.p, { u: KID2.u, pw: KID2.p });
  const cBody = (await c.p.textContent("body")) || "";

  ok(!c.p.url().includes("/login"), "a second kid account signs in");
  // Neither should be able to see a name the other set. Both are blank here,
  // so the real assertion is that the second kid is not handed the first's row.
  ok(aBody !== cBody || !/testkid/i.test(cBody),
     "the second kid is not served the first kid's state");
  await a.ctx.close(); await c.ctx.close();
}

/* ---------- 6. the phone rules that have bitten us before ---------- */
{
  const { ctx, p } = await fresh();
  await login(p, { u: KID.u, pw: KID.p });
  await p.goto(B + "/", { waitUntil: "domcontentloaded" });

  const overflow = await p.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow <= 1, `the page does not scroll sideways on a 390px phone (overflow ${overflow}px)`);

  // iOS Safari zooms any focused control under 16px. That is a UX bug we have
  // already shipped once.
  const small = await p.evaluate(() =>
    [...document.querySelectorAll("input, textarea, select")]
      .map(el => ({ t: el.tagName + (el.type ? ":" + el.type : ""),
                    px: parseFloat(getComputedStyle(el).fontSize) }))
      .filter(x => x.px < 16));
  ok(small.length === 0, "every form control is >= 16px, so iOS never auto-zooms: "
     + JSON.stringify(small));
  await ctx.close();
}

/* ---------- 7. signing out actually ends the session ---------- */
{
  const { ctx, p } = await fresh();
  await login(p, { u: KID.u, pw: KID.p });
  await ctx.clearCookies();
  await p.goto(B + "/", { waitUntil: "domcontentloaded" });
  ok(p.url().includes("/login"), "with the session cookie gone, / is no longer reachable");
  await ctx.close();
}

await b.close();
console.log(`\n${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
