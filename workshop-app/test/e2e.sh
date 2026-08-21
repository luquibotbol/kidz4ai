#!/bin/bash
# macOS-compatible e2e harness. Replaces the Linux/Postgres one deleted on
# 2026-08-20 (see docs/CLAUDE.md).
#
# No database is required: with no Cloudflare binding present, lib/db.ts falls
# back to an in-memory store, which is exactly what a test wants — every run
# starts clean and nothing can touch production D1.
set -u
cd "$(dirname "$0")/.."

free_port() { lsof -ti tcp:"$1" 2>/dev/null | xargs kill -9 2>/dev/null; }
free_port 3100; free_port 3200
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "mock-openai" 2>/dev/null

for p in 3100 3200; do
  if lsof -ti tcp:$p >/dev/null 2>&1; then echo "PORT $p STILL BUSY"; exit 1; fi
done
echo "ports free"

if [ ! -d .next ] || [ "${REBUILD:-0}" = "1" ]; then
  echo "building…"; npx next build >/tmp/k4-build.log 2>&1 || { tail -20 /tmp/k4-build.log; exit 1; }
fi

# Test accounts only. Never the real ones — this file is public.
export AUTH_SECRET="e2e-secret-not-used-anywhere-real"
export KID_USERNAME=testkid   KID_PASSWORD=fixture-pw
export KID2_USERNAME=otherkid KID2_PASSWORD=fixture-pw2
export PARENT_USERNAME=testparent PARENT_PASSWORD=fixture-pw3
export OPENAI_API_KEY=test-key
export OPENAI_BASE_URL=http://localhost:3200/v1
export SEED_DEMO=0

node test/mock-openai.js >/tmp/k4-mock.log 2>&1 & M=$!
npx next start -p 3100 >/tmp/k4-next.log 2>&1 & A=$!
for i in $(seq 1 45); do
  curl -fs -o /dev/null http://localhost:3100/login && break
  sleep 1
done
if ! curl -fs -o /dev/null http://localhost:3100/login; then
  echo "FATAL: server never came up"; tail -20 /tmp/k4-next.log; kill -9 $M $A 2>/dev/null; exit 1
fi
echo "server up"

node test/e2e.mjs
RC=$?

kill -9 $M $A 2>/dev/null
free_port 3100; free_port 3200
exit $RC
