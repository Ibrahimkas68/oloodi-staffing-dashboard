# AI usage log

Every significant AI-assisted step: what I asked, what the tool produced, what I changed or
rejected, and how I verified it. Tools: Claude (Claude Code), Spec Kit, Claude Design.

Rule: no generated code is committed before I have read it and a test or a recorded manual check
covers it.

## Entry format

### YYYY-MM-DD · Phase or task · Tool
- **Asked:**
- **Produced:**
- **Changed or rejected:**
- **Verified:**

---

## Entries

### 2026-11-08 · Specification · Spec Kit + Claude
- **Asked:** constitution, one core spec, plan and tasks from my cahier des charges.
- **Produced:** `.specify/memory/constitution.md` and `specs/001-live-staffing-dashboard/`
  (spec, plan, research, data model, contracts, quickstart, tasks).
- **Changed or rejected:** kept one spec instead of several; moved all infrastructure into
  `infra/`; kept A1 (no re-invite after Decline) after checking the brief.
- **Verified:** spec quality checklist; constitution check in the plan; task format check.

### 2026-11-09 · Phase 1 setup (T001 to T012) · Claude
- **Asked:** repository setup: workspaces, TypeScript, lint, test runners, Compose, env example,
  README and log skeletons.
- **Produced:** root config files, `shared`, `server`, `web`, `e2e` packages, `compose.yaml` and
  `infra/docker/docker-compose.yml`, `.env.example`.
- **Changed or rejected:** pinned ESLint 9 because `eslint-plugin-react` does not support ESLint 10
  yet; pinned `@types/node` 22 to match the runtime; kept React 18 as planned (latest is 19).
- **Verified:** see the Phase 1 checkpoint in the commit message (install, typecheck, lint, tests,
  database healthy).
