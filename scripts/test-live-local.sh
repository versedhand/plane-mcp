#!/bin/bash
# test-live-local.sh — run the LIVE-DB suite against a THROWAWAY Postgres, never a real Plane.
#
# WHY (2026-11-20, arch-defect-sweep N078). 13 of 17 tests skip unless PLANE_*_DB_HOST is set, and setting
# it meant pointing them at production (they CREATE issues). So the SQL write path this package publishes,
# the one that produced two silent-failure defects (a label accepted then dropped; an emptied target_date
# flipping an issue to Done), shipped untested. This starts postgres:15 in docker on 127.0.0.1, loads the
# structure of the 11 Plane tables plane-mcp touches (test/fixtures/plane-schema.sql, no data), seeds the
# synthetic fixtures the tests assert on, runs vitest against it, and removes the container.
#
# It forces every DB host to 127.0.0.1 and unsets the Plane API env, so it cannot reach a real instance
# whatever the caller's environment holds. Used by `npm run test:live-local`, prepublishOnly and CI.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="${PG_IMAGE:-postgres:15}"
NAME="plane-mcp-test-$$"
PW="plane-mcp-throwaway"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD="$PW" -p 127.0.0.1::5432 "$IMAGE" >/dev/null
PORT=$(docker port "$NAME" 5432/tcp | head -1 | sed 's/.*://')
for _ in $(seq 1 60); do
    docker exec "$NAME" pg_isready -U postgres -q 2>/dev/null && break
    sleep 1
done
docker exec "$NAME" pg_isready -U postgres -q
# pg_isready can answer during the init-time restart; one real query proves the final server is up.
for _ in $(seq 1 30); do docker exec "$NAME" psql -U postgres -qtAc 'SELECT 1' >/dev/null 2>&1 && break; sleep 1; done

psql_in() { docker exec -i -w / "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
for db in plane_personal plane_nts lifedb; do psql_in -c "CREATE DATABASE $db"; done
for inst in personal nts; do
    psql_in -d "plane_$inst" < test/fixtures/plane-schema.sql
    # seed files \i the shared library; feed both on stdin in order instead of copying files in
    { cat test/fixtures/seed-lib.sql; grep -v '^\\i ' "test/fixtures/seed-$inst.sql"; } | psql_in -d "plane_$inst"
done

unset PLANE_PERSONAL_API_URL PLANE_PERSONAL_API_KEY PLANE_NTS_API_URL PLANE_NTS_API_KEY PLANE_DB_HOST LIFEDB_URL
export PGHOST=127.0.0.1
export PLANE_PERSONAL_DB_HOST=127.0.0.1 PLANE_PERSONAL_DB_PORT="$PORT" PLANE_PERSONAL_DB_NAME=plane_personal \
       PLANE_PERSONAL_DB_USER=postgres PLANE_PERSONAL_DB_PASSWORD="$PW" PLANE_PERSONAL_WORKSPACE_SLUG=personal
export PLANE_NTS_DB_HOST=127.0.0.1 PLANE_NTS_DB_PORT="$PORT" PLANE_NTS_DB_NAME=plane_nts \
       PLANE_NTS_DB_USER=postgres PLANE_NTS_DB_PASSWORD="$PW" PLANE_NTS_WORKSPACE_SLUG=nts
export LIFEDB_HOST=127.0.0.1 LIFEDB_PORT="$PORT" LIFEDB_NAME=lifedb LIFEDB_USER=postgres LIFEDB_PASSWORD="$PW"
export PLANE_MCP_THROWAWAY_DB=1
npx vitest run "$@"
