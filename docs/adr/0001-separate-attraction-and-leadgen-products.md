# ADR 0001: Separate attraction and leadgen as products

## Status

Superseded by ADR 0003 for target architecture. Kept as historical context for
the earlier split between attraction and leadgen.

## Context

- `attraction` and `leadgen` have separate module ontologies.
- `leadgen` owns its report registry, dashboard interface, Paperclip context,
  and manager whitelist.
- The shared design contract keeps shell, control, and component language
  common, but module reports remain module-owned.
- The project will be split into two repositories only after platform seams are
  explicit enough to avoid copying hidden coupling.

## Decision

Treat `attraction` and `leadgen` as separate products. Keep shared/platform
narrow: auth, RBAC, module membership, dashboard comments, Paperclip routing
primitives, safe local snapshot primitives, contracts/tooling needed by both
products, and shared UI primitives.

Do not put module-owned report logic, report registry, ontology, manager
whitelist, sync policy, screen copy, or module-specific dashboard layout into
the shared platform.

Future AI-agent or automation layers are shared/platform consumers. They must
use explicit module capabilities and safe read models rather than bypassing
module ownership or reading arbitrary module storage directly.

## Consequences

- Shared/platform changes must list which modules and roles they affect.
- Module-owned work must not change the other product unless explicitly marked
  shared/platform.
- Repository extraction should happen after storage, route, sync, and web
  runtime seams are visible.
- Future module additions should provide their own ontology, report ownership,
  sync policy, and agent-safe capability surface before broad automation.
