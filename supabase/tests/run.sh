#!/bin/sh
# Runs rls_test.sql in a throwaway database. PGHOST/PGPORT/PGUSER pick the local server.
set -e
cd "$(dirname "$0")"
db="ff_rls_$$"
createdb "$db"
trap 'dropdb "$db"' EXIT
psql -q -X -d "$db" -f rls_test.sql 2>&1 | grep -E 'ok:|FAILED|ERROR'
