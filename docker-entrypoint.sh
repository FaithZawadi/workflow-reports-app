#!/bin/sh
set -e

echo "Applying database migrations..."
node node_modules/prisma/build/index.js migrate deploy || {
  echo "migrate deploy failed (is the database reachable?)"; exit 1;
}

# Seed only once — tracked by a marker inside the DB via a harmless upsert in the seed.
if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "Seeding baseline data (safe to re-run)..."
  node prisma/seed.mjs || echo "seed skipped/failed (continuing)"
fi

echo "Starting QSL server on :${PORT:-3000}"
exec node server.js
