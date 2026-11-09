#!/bin/sh
# Drop, recreate and seed the database (owner role). Requires the db container to be running.
set -eu
cd "$(dirname "$0")/../.."
exec npx tsx --conditions=source server/src/db/reset.ts
