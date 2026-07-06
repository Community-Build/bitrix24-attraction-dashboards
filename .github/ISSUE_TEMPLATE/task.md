---
name: Backlog task
about: Track dashboard product or engineering work
title: ""
labels: ""
assignees: ""
---

## Problem


## Module
- [ ] `attraction`
- [ ] `leadgen` legacy/removal only
- [ ] shared/platform

Apply exactly one module label:

- `module:attraction`
- `module:leadgen` only for explicit legacy containment/removal work
- `module:shared-platform`

## Affected Areas
- [ ] API / auth / RBAC
- [ ] reporting / sync / data contract
- [ ] web UI / report registry
- [ ] comments / Paperclip
- [ ] docs / agent instructions
- [ ] deploy / infra

## Expected Behavior


## Acceptance Criteria
- [ ] 

## Data Dependencies
- 

## Module Isolation Notes
- Attraction behavior must remain unchanged unless this is an attraction or shared/platform task.
- Leadgen is legacy per ADR 0003; do not create new leadgen product work.
- Leadgen behavior must remain unchanged unless this is an explicit legacy containment/removal task.
- Dashboard comments route to module-specific Paperclip projects: `attraction` -> `Attraction Dashboard`; `leadgen` remains legacy until removal.
- Do not use or expose deal names, contact names, phones, emails, raw Bitrix payloads, cookies, tokens, or secrets.

## Verification
- [ ] API tests updated or not needed
- [ ] Web tests updated or not needed
- [ ] Manual check notes added if relevant
