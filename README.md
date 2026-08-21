# Kids4AI

An AI mentor for teenagers who would rather build something than be taught
something.

Most educational software optimises for time in the app. This optimises for
artifacts. It gives a kid one project at a time, breaks it into three to five
concrete steps, and gives each step a ready-to-paste prompt for their own AI
chat. The app deliberately does not do the work — research on AI tutoring finds
students who let a model answer for them score about 17% worse once it is taken
away — so it coaches, predicts and keeps score instead.

The scoreboard is three numbers, and all three are things that exist outside
the kid's head: what they made, how many people beyond their family used it,
and what they kept after costs.

## What it refuses to do

No streaks. No points, XP, badges or leaderboards. No loss framing. No
variable-ratio rewards. No engagement metric anywhere on screen, for the kid or
the parent.

That is a design decision with evidence behind it, not squeamishness. Deci's
meta-analysis puts expected contingent rewards at −0.28 to −0.44 on intrinsic
motivation, and worse in children. What does work is success-contingent
feedback (+0.45), genuine choice, and recognition that arrives unannounced
rather than promised. So the app celebrates a real ship and nothing else, and
its strongest moments — the first stranger who used your thing, the first
person who paid you — fire once each and are never advertised in advance.

Every mission also commits to a falsifiable prediction: what will break, and on
which day. When it comes true, the kid trusts everything else it says. When it
does not, the app says so.

## Boundaries

It is built for minors, so a few things are structural rather than
configurable:

- The parent view shows the work — projects, progress, earnings — and never the
  kid's conversation with the coach. That is promised to the kid in the app's
  own disclosure and enforced in code, with an end-to-end test that fails if it
  ever stops being true.
- Every account's state lives in its own row. No shared state between kids.
- Content filtering and a small set of escalation paths are handled in
  `spec-09`, not left to the model.

## Stack

Next.js 15 (App Router) and TypeScript, deployed to Cloudflare Workers via
`@opennextjs/cloudflare`, with D1 as the only datastore — one JSON document per
user, no ORM and no connection pool. OpenAI for generation, with a provider
shim so a Gemini-compatible endpoint can be swapped in.

```
workshop-app/
  app/        routes, server actions
  lib/        all pure logic — state, prompts, auth, expression evaluator
  components/ UI
  test/       unit tests + the browser suite
```

Pure logic lives in `lib/` so it can be tested without a browser or a network.

## Running it

```bash
cd workshop-app
npm install
cp .env.example .env.local     # fill in AUTH_SECRET, OPENAI_API_KEY, accounts
npm run dev
```

```bash
npm test        # unit tests over lib/
npm run e2e     # browser suite; needs no database, cannot touch production
```

There is no self-serve signup. Accounts are configured as environment
variables, one pair per kid, which is deliberate at this stage.

## Status

Early, and in real use by a small number of people. Design documents and specs
are kept in a separate private repository because they discuss identifiable
users.
