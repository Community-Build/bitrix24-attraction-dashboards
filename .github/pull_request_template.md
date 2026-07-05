## Summary
- 

## Module
- [ ] `attraction`
- [ ] `leadgen` legacy/removal only
- [ ] shared/platform

Module label:
- [ ] `module:attraction`
- [ ] `module:leadgen` only for explicit legacy containment/removal work
- [ ] `module:shared-platform`

## Affected Areas
- [ ] API / auth / RBAC
- [ ] reporting / sync / data contract
- [ ] web UI / report registry
- [ ] comments / Paperclip
- [ ] docs / agent instructions
- [ ] deploy / infra

## Issue
- Closes #

## Verification
- [ ] `pnpm --filter @bitrix24-reporting/api test -- --runInBand`
- [ ] `pnpm --filter @bitrix24-reporting/web exec vitest run`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `ENV_FILE=.env.example docker compose -p bitrix24-reporting config >/dev/null`
- [ ] Module-specific smoke notes added
- [ ] Other:

## Notes
- 

## Module Isolation
- [ ] Module ontology was checked for every selected module.
- [ ] Attraction behavior is unchanged unless `attraction` or `shared/platform` is selected.
- [ ] Leadgen is treated as legacy per ADR 0003; no new leadgen product behavior is introduced.
- [ ] Leadgen behavior is unchanged unless this is an explicit legacy containment/removal task.
- [ ] Paperclip project routing is unchanged or explicitly verified for affected attraction/platform work.
- [ ] No deal names, contact names, phones, emails, raw Bitrix payloads, cookies, tokens, or secrets are stored, displayed, logged, or sent to Paperclip.
