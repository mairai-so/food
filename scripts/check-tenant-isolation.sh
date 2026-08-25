#!/usr/bin/env bash
set -euo pipefail

# The focused tenant test is intentionally kept as a separate command so it
# can be run in CI without starting the API or requiring a database.
../../scripts/node_modules/.bin/tsx --test src/lib/tenant-filter.test.ts