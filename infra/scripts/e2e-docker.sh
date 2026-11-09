#!/bin/sh
# Run the end-to-end tests in containers, then always remove them and their throwaway database,
# also after a failure or Ctrl-C. Exit code is the test result. Needs Docker; the first run
# downloads the large Playwright image.
set -u
cd "$(dirname "$0")/../.."

compose="docker compose -f infra/docker/docker-compose.e2e.yml"

cleanup() {
  $compose down -v
}
trap cleanup EXIT
# Not every shell runs the EXIT trap on a signal: turn a signal into a normal exit.
trap 'exit 130' INT TERM HUP

# The report folders are bind-mounted; create them as the current user so they are not root-owned.
mkdir -p e2e/playwright-report e2e/test-results

$compose up --build --abort-on-container-exit --exit-code-from e2e
# The EXIT trap runs cleanup and the script keeps this exit status.
exit $?
