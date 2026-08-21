# workshop-app

The application. See the [repository README](../README.md) for what Kids4AI is
and why it is built the way it is.

## Run it

```bash
npm install
cp .env.example .env.local     # AUTH_SECRET, OPENAI_API_KEY, one pair per account
npm run dev
```

State lives in Cloudflare D1 in production. Locally there is no binding, so
`lib/db.ts` falls back to an in-memory store that resets when the process does —
which is also what makes the test suite safe to run against nothing.

## Check it

```bash
npx tsc --noEmit    # types
npm test            # unit tests over lib/
npm run e2e         # browser suite; no database, cannot reach production
```

## Deploy it

```bash
npm run deploy      # next build -> opennextjs-cloudflare -> wrangler
```

Deploying needs a Cloudflare account with a D1 database bound as `DB`, and
secrets set with `wrangler secret put` — never as `vars`, which are committed.

`npm run deploy` passes `-c wrangler.private.jsonc`, an untracked config holding
the custom domain and alert sender. The committed `wrangler.jsonc` has neither,
so a fork deploys a working Worker without trying to claim someone else's
domain. Create your own private config, or drop the `-c` flag and add a route.

## Layout

```
app/         routes and server actions
lib/         all pure logic — state, prompts, auth, expression evaluator
components/  UI
test/        unit tests, plus the Playwright suite and its OpenAI mock
```

Pure logic lives in `lib/` so it can be tested without a browser or a network.
Design documents are in a separate private repository: they discuss
identifiable users.
