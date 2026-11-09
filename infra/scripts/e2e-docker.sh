#!/bin/sh
# Run the end-to-end tests in containers, then always remove them and their throwaway database,
# also after a failure or Ctrl-C. Exit code is the test result. Needs Docker; the first run
# downloads the large Playwright image.
#
# Usage: e2e-docker.sh [measure]
#   (no argument)  run the Playwright tests
#   measure        run the update delay and recovery measurement instead (npm run measure:docker)
set -u
cd "$(dirname "$0")/../.."

compose="docker compose -f infra/docker/docker-compose.e2e.yml"

cleanup() {
  $compose --profile measure down -v
}
trap cleanup EXIT
# Not every shell runs the EXIT trap on a signal: turn a signal into a normal exit.
trap 'exit 130' INT TERM HUP

# The bind-mounted folders are created as the current user so they are not root-owned.
mkdir -p e2e/playwright-report e2e/test-results e2e/measure-results

case "${1:-tests}" in
  tests)
    $compose up --build --abort-on-container-exit --exit-code-from e2e
    ;;
  measure)
    # The image has no .git, so describe the host here and pass it in. Anything unavailable is
    # left as "unknown" in the output; it never stops the run.
    MEASURE_GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
    # An empty answer means a clean tree; a failing git means we do not know (left empty).
    if status=$(git status --porcelain 2>/dev/null); then
      if [ -n "$status" ]; then MEASURE_GIT_DIRTY=true; else MEASURE_GIT_DIRTY=false; fi
    else
      MEASURE_GIT_DIRTY=
    fi
    MEASURE_DOCKER_INFO=$(docker info --format '{{.ServerVersion}} {{.NCPU}} {{.MemTotal}} {{.OperatingSystem}}' 2>/dev/null || echo unknown)
    export MEASURE_GIT_COMMIT MEASURE_GIT_DIRTY MEASURE_DOCKER_INFO
    $compose --profile measure build && $compose run --rm -T measure
    ;;
  *)
    echo "Usage: $0 [measure]" >&2
    exit 2
    ;;
esac
# The EXIT trap runs cleanup and the script keeps this exit status.
exit $?
