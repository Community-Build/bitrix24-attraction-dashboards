# AGENTS.md

## Project
This repository contains Bitrix24 attraction dashboards: local API, SQLite-backed reporting, and web/prototype dashboards.
The durable project map is `docs/product/PROJECT_STRUCTURE.md`; read it before architecture, module, reporting, call-analysis, Telegram, MCP, Paperclip, or sync work.
The target product is `attraction`. `leadgen` is legacy until a dedicated removal migration deletes it; do not use leadgen as a design constraint for new work.

## Working Rules
- Do not work directly on `main` except for emergency repository maintenance.
- Use branches named `codex/<task-name>` for implementation work.
- For frontend/UI changes, read `design.md` before editing and keep module-specific screens on the shared project design system unless a reviewed shared/platform issue explicitly changes it.
- Keep each branch tied to a backlog item or GitHub issue.
- Keep git hygiene as a priority: before starting a new task, close stale work, merge verified completed branches, delete obsolete local/remote branches, and start fresh work from updated `main`.
- At the start of every new implementation, review, or Paperclip delegation session, run the Session Currency Gate below before editing code or marking work ready.
- Always work from the latest visible project state. Before cleanup, branch switches, merges, rebases, stash use, or new task setup, preserve all user and agent changes in a named branch and commit unless the user explicitly asks for a different storage method.
- Never leave important work only in stash. If unrelated WIP blocks cleanup or implementation, move it to a clearly named backup branch/commit and report that branch before continuing.
- Prefer small, reviewable changes over broad mixed commits.
- Do not commit local runtime state, raw Codex comments, SQLite databases, secrets, or Bitrix snapshots.
- Do not commit runtime Paperclip proof folders under `.paperclip/tasks/` unless an issue explicitly asks for durable evidence in git.
- Convert prototype comments from `.codex/proto-comments/comments.json` into GitHub issues or `docs/backlog.md` items before implementation.
- Use the Context7 MCP server frequently when library/framework/API documentation may affect implementation details or when current docs are needed.

## Code Review Graph
- This repository is graph-aware via `code-review-graph`. At the start of code review, debugging, architecture, refactor, or blast-radius work, use the Code Review Graph MCP tools before broad file reads when the graph is available.
- Mandatory CRG gate: for any code-facing task, first call `get_minimal_context_tool` with `repo_root="/Users/vladislavbogdan/Documents/Вайб-проекты/Модуль \"Привлечение\"/Дашборды Привлечения"` and a task-specific description before broad `rg`, file reads, production reasoning, or implementation work.
- Code-facing tasks include code review, debugging, architecture review, refactor, implementation, production incident analysis, Bitrix/reporting data correctness, sync/import behavior, module UI changes, Paperclip implementation follow-up, and test coverage work.
- Module ontology, backlog, and Paperclip planning tasks still require the CRG gate when they make claims about source behavior, data pipelines, API boundaries, dashboard screens, or production impact. Pure prose-only planning may skip CRG only with an explicit reason.
- If changed files or branch risk matter, follow the gate with `detect_changes_tool` or `get_impact_radius_tool` before manual diff/file review.
- If ownership or call relationships are unclear, use `semantic_search_nodes_tool` or `query_graph_tool` before broad repository search unless the exact file path is already known.
- Prefer `get_review_context_tool`, `get_minimal_context_tool`, `get_impact_radius_tool`, `detect_changes_tool`, `semantic_search_nodes_tool`, `query_graph_tool`, `list_flows_tool`, `list_communities_tool`, and `get_architecture_overview_tool` to gather focused context.
- Full CRG tool access is enabled for this project. Use write/refactor tools only when the current task explicitly calls for code changes, then verify the resulting diff and tests normally.
- Treat graph output as retrieval context, not authority. Source files, git diff, local instructions, tests, and production data rules win over graph summaries.
- If a CRG tool cannot infer the current repository, pass `repo_root="/Users/vladislavbogdan/Documents/Вайб-проекты/Модуль \"Привлечение\"/Дашборды Привлечения"`.
- Skip CRG only for purely administrative, git-only, or prose-only tasks. If skipped, say `CRG skipped: <reason>` in the first progress update and in the final report.
- Final reports for code-facing tasks must include `CRG: <tools used>` or `CRG skipped: <reason>`. Do not claim deep review, architecture analysis, debugging, data correctness, production impact, or blast-radius work is complete without that line.

## Session Currency Gate
- Before code edits, run `git status --short`, `git branch --show-current`, and `git remote -v`, then run `pnpm session:preflight`.
- `pnpm session:preflight` must pass before ordinary implementation, delegation, review-ready claims, PR creation, merge, or deploy work. It fails when the worktree is dirty, the branch is `main` or detached, `origin/main` cannot be fetched, or the branch is behind the latest fetched base.
- If the preflight fails, do not continue by overwriting or ignoring the state. Preserve all user and agent work in a named branch and commit, inspect the diff, then reconcile with the latest base through a non-destructive git operation.
- Use `pnpm session:preflight --allow-dirty` only when continuing the same active task after reading `git diff` and confirming the dirty files belong to that task.
- Use `pnpm session:preflight --allow-main` only for read-only checks or explicit emergency repository maintenance.
- Use `pnpm session:preflight --no-fetch` only in an intentionally offline runtime after confirming refs were updated externally; record that limitation in the handoff.
- Paperclip agents must record the command and result in proof artifacts or issue comments for any non-trivial code task.

## Backlog And Issues
- GitHub Issues are the source of truth once the remote repository is connected.
- `docs/backlog.md` mirrors the current product backlog and is useful for local planning.
- Every issue should include: problem, expected behavior, acceptance criteria, data dependencies, and verification plan.
- Use labels by area: `area:sales`, `area:activities`, `area:cohorts`, `area:funnel`, `area:infra`.
- Use labels by kind: `type:feature`, `type:bug`, `type:performance`, `type:data`, `needs:clarification`.
- Use priority labels: `priority:p0`, `priority:p1`, `priority:p2`.

## Role Routing
- Architecture, decomposition, system boundaries: `architect`.
- Fast read-only codebase lookup: `scout`.
- Frontend UI/UX implementation: `frontend`.
- Backend/API/database work: `backend`.
- Bug investigation and minimal fixes: `debugger`.
- Test authoring and coverage: `tester`.
- Security review: `security`.
- Refactors without behavior changes: `refactorer`.
- Pre-merge review: `reviewer`.
- Infra and CI/CD: `devops`.
- Generic implementation tasks: `worker_high`, `worker_xhigh`, or `worker_mini`.

If a named preset is unavailable in the current runtime, emulate it with the closest built-in agent while preserving the preset's intent.

## Paperclip Operating Layer
- Paperclip company `Bitrix24 Dashboards` is configured as the agent runtime for dashboard comments and small maintenance work.
- Versioned Paperclip operating docs live under `ops/paperclip/`; update these before changing live Paperclip instructions when feasible.
- Active runtime agents are documented in `ops/paperclip/agents/README.md`; their canonical instruction bundles live under `ops/paperclip/agents/<agent-slug>/`.
- The normal dashboard-comment workflow is: module ontology -> persisted dashboard comment -> Paperclip issue -> triage/spec -> specialist implementation -> proof artifacts -> fresh review -> PR/deploy -> status notification.
- The normal workflow does not use SSH/root access. Server work requires an explicit release/devops or incident task with approval and redacted output.
- Keep Paperclip dashboard notifications product-level in V1: sent, in work, needs input, done, failed. Do not expose Paperclip links in the dashboard unless a reviewed product issue changes that rule.

## Module Ontology
- Every business module must have `docs/modules/<module-key>/MODULE_ONTOLOGY.md` before broad automation or Paperclip delegation.
- Module ontology must define entities, roles, states, data scope, report ownership, access boundaries, and privacy exclusions.
- V1 module is `attraction`; use `docs/modules/attraction/MODULE_ONTOLOGY.md` as the current module contract.
- `leadgen` is legacy/retired for target architecture per ADR 0003. Keep existing code stable until a dedicated deletion task, but do not add new leadgen features or preserve abstractions only for leadgen.
- Future modules require a new ADR before they become design constraints. Do not force new modules into the attraction UI if their workflow, metrics, or roles differ.
- Shared platform changes must state which attraction roles and platform surfaces they affect and how attraction behavior remains protected.

## Paperclip Proof Loop
- For non-trivial Paperclip development tasks, follow `ops/paperclip/proof-loop.md`.
- Full proof mode is required for auth, RBAC, database, migrations, reporting SQL, Paperclip integration, production/deploy, cross-module, and multi-agent changes.
- Required artifact names are `spec.md`, `evidence.md`, `evidence.json`, `verdict.json`, and `problems.md` under `.paperclip/tasks/<paperclip-issue-id>/` while working. Full proof mode also requires a durable handoff in the Paperclip issue or an explicitly tracked sanitized evidence folder before review.
- Light mode is allowed only for small copy/UI-only changes and the reason must be documented in the issue.
- Implementation and final verification should be separated by role or fresh context whenever practical.

## Paperclip Team Evolution
- Do not add agents just because a role can be named. Split a role only when it has distinct context, quality criteria, recurring deliverables, and enough task volume.
- `Dashboard Engineering Manager` owns triage, planning, orchestration, final readiness, and agent-ops governance until volume justifies split-out roles.
- Split out `Agent Operations Manager` when repeated process defects, stale skills/MCP config, or more than five Paperclip tasks per week make it useful.
- Split out `Release / DevOps Agent` when deploys, server checks, or production incidents become recurring Paperclip work.
- Self-correction is reactive after failures; self-improvement is periodic and proposal-based. Agents must not silently rewrite team rules, tools, skills, or MCP servers.

## Reporting Rules
- All business dashboards must stay scoped to the agreed attraction manager whitelist unless an issue explicitly changes that rule.
- Reports should use the local API and SQLite snapshot. Do not add direct Bitrix reads to page rendering.
- Bitrix sync is a separate operation; dashboard screens should read cached local data.
- Heavy reports should be loaded lazily by active screen or background prefetch, not block the initial UI render.
- Never fetch or store deal names or structured contact personal data for reporting. Use deal/contact IDs only; if upstream Bitrix responses include names, phones, emails, or other personal fields, ignore or redact them before persistence and UI output. The reviewed exception is messenger message body text in the dedicated attraction message tables defined by ADR 0006: it may be stored for leader-only communication analysis, but must never enter aggregate responses, logs, MCP, dashboard comments, notifications, or raw payload storage.

## Verification
- Session currency: `pnpm session:preflight`.
- API targeted tests: `pnpm --filter @bitrix24-reporting/api exec vitest run <test files relative to apps/api, e.g. test/http.test.ts>`.
- API full suite: `pnpm --filter @bitrix24-reporting/api test`.
- Web full suite: `pnpm --filter @bitrix24-reporting/web exec vitest run`.
- Workspace checks before PR when feasible: `pnpm test`, `pnpm lint`, `pnpm typecheck`.
- If a command cannot be run, state exactly why in the PR or final handoff.

## Git Flow
- Start from updated `main`.
- Create a task branch: `git switch -c codex/<task-name>`.
- Commit with a focused message that references the issue when available.
- Push the branch and open a draft PR for non-trivial work.
- Merge only after tests are green and review comments are resolved or explicitly deferred.
- For production-requested fixes, do not stop at an unmerged branch or PR. After local verification, push the `codex/*` branch, open the PR, wait for green GitHub checks, merge to `main`, wait for the GitHub Actions `Deploy Production` workflow, then verify production.

## Proven Git, Deploy, And Server Practices
- Treat GitHub Actions as the production path: implement locally, run focused checks, commit, push a `codex/*` branch, open a PR, wait for CI, merge, then wait for `Deploy Production`.
- When a user asks to fix comments/issues found in the deployed app, assume the expected handoff is a deployed production fix through `main` unless they explicitly say to stop before merge/deploy.
- Dashboard comment archival is board/user-owned review state. Agents must not archive production dashboard comments automatically after deploy or proof. Archive a production dashboard comment only when the board explicitly asks to archive that exact comment.
- After a production deploy, verify the actual VPS state, not only GitHub: check `/opt/bitrix24-reporting/app` commit, container status, health endpoint, and the specific API behavior changed by the PR.
- Keep production verification explicit and repeatable. Good smoke checks include `curl https://dashboardpriv.claricont.com/api/health`, unauthenticated protected endpoint returning `401`, authenticated endpoint behavior with session cookie and CSRF, and direct API port not reachable externally.
- Never print or paste production passwords, session cookies, Bitrix webhooks, raw tokens, or raw payloads. If a server-side password file exists, read it inside the remote command and only print non-secret status such as `login: ok`.
- For authenticated production API checks, use the existing admin account, read the password from `/root/bitrix24-reporting-admin-password.txt` on the VPS, keep cookies in memory or a temporary file, and remove any smoke-test records after verification.
- Before touching production data, identify the mounted SQLite path and make a backup when the operation can mutate business data. The production database is expected under `/opt/bitrix24-reporting/data/bitrix24-reporting.db` on the host and `/app/data/bitrix24-reporting.db` in the app container.
- Do not copy local SQLite over production unless the user explicitly approves that destructive replacement. Prefer fixing the sync/import logic and preserving the production DB.
- For Docker checks, prefer `docker ps`, `docker compose ps`, `docker logs --tail`, `docker exec`, and app-local Node scripts from `/app/apps/api` so workspace dependencies resolve correctly.
- When querying SQLite inside the container, run from `/app/apps/api` because package resolution for `better-sqlite3` is local to the API workspace.
- Keep the app container non-root. Verify with `docker inspect -f '{{.Config.User}}' bitrix24-reporting-app-1` and `docker exec bitrix24-reporting-app-1 id`.
- Keep reverse proxy ownership clear: public traffic goes through Caddy/nginx on `443`; the Node app should remain bound to localhost or the internal Docker network.
- For data correctness incidents, compare local and production counts with the same SQL/query semantics before changing code or importing data. Always pin the exact date range, funnel/category, manager whitelist, and stage rules used for the comparison.
- For prototype comments, production comments are stored server-side in SQLite through `/api/proto-comments`; do not rely on `.codex/proto-comments/comments.json` for production. Each comment should retain block anchor metadata: block id, block label, block selector, element selector, and relative coordinates inside the block.
