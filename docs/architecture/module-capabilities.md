# Module Capabilities

The module capability manifest is the shared/platform contract for module
discovery, fork-owned custom module integration, and AI-agent-safe read access.

ADR 0003 sets the target product architecture to attraction-only. Leadgen
capability behavior may remain in code while the legacy removal migration is
pending, but leadgen is not an active product surface and must not drive new
module abstractions.

It is intentionally metadata-only. A manifest is not a report implementation,
not a repository adapter, and not an agent runtime. It describes what a module
owns and which safe platform surfaces a caller may use.

## Ownership

Shared/platform owns:

- the manifest schema in `@bitrix24-reporting/contracts`;
- the API registry plumbing;
- the HTTP capability endpoints;
- the authorization rules for reading manifests.

Each module owns:

- its manifest values;
- ontology links;
- report descriptors;
- data scope;
- privacy rules;
- capability semantics.

Historically, `attraction` and `leadgen` were separate products. After ADR 0003,
`attraction` is the only active product target. A fork-owned module such as a
neutral `custom-module` fixture must publish its own ontology reference, report
descriptors, safe read models, and data policy instead of copying attraction
assumptions.

## Report Status

Each report descriptor has a `status`:

- `available` means the route is wired for the current API process and can be
  treated as a live capability by UI or agent tooling;
- `planned` means the descriptor is valid product metadata, but the route is not
  live yet and callers must not execute it as an available report;
- `disabled` is reserved for intentionally hidden or suspended reports.

The API normalizes report status from the live route/service wiring supplied by
each module capability adapter. A manifest may describe a fork-owned custom
module, but report descriptors for unwired routes are returned as `planned`, not
`available`.

## Fork-Owned Modules And Integrations

A fork-owned module is not a product roadmap promise in this repository. It is a
source-level extension point for an open-source fork.

A fork owner may add their own CRM/source data adapter, sync adapter, route
registrar, report descriptors, ontology reference, and manifest adapter in their
fork. Shared/platform owns the manifest schema, registry, auth filtering,
availability normalization, and safe data policy validation.

V1 is source-code fork friendly, not a package/plugin runtime. Future package or
plugin loading is allowed only after this source-level seam is stable and real
fork maintainers need runtime package discovery.

## Agent Boundary

Future AI-agent work must consume module capabilities through this boundary:

- manifest metadata;
- report descriptors;
- safe read model descriptors;
- module data policy;
- explicitly forbidden fields.

Agents must not consume or receive:

- raw SQLite handles;
- full repository adapters such as `SqliteRepository`;
- direct Bitrix clients or webhooks;
- raw Bitrix payloads;
- deal names;
- contact names, phones, emails, or other personal fields;
- filesystem, token, cookie, or secret access.

The first manifest version therefore uses serializable fields only. It exposes
route and schema identifiers, not executable functions. `agentReadable: true`
means a reviewer must treat the capability as privacy-sensitive and verify that
the route returns aggregate or safe read data only.

Call enrichment writeback is a destructive capability, not part of the current
metadata-only manifest. A future module may declare a similar capability only
with an explicit ADR, field allowlist, approval flow, and audit contract.

## Attraction Agent-Readable Reports

The attraction manifest must describe every live attraction analytics route so
agent tooling can rely on one catalog instead of a hidden allowlist. A descriptor
being present does not mean an agent may execute it. Agent execution requires:

- `status: "available"`;
- `agentReadable: true`;
- the module data policy to keep `piiExcluded: true`, `rawPayloadAccess: false`,
  `directBitrixAccess: false`, and `arbitrarySqliteAccess: false`.

`unit-economics` is catalog-visible but remains `agentReadable: false` until a
separate safe-output review explicitly approves agent execution. This preserves a
denial path for sensitive financial analytics while still making the report
discoverable in the module capability catalog.

## HTTP Surface

The platform exposes manifest metadata through:

- `GET /api/modules/capabilities`;
- `GET /api/modules/:moduleId/capabilities`.

The response envelopes are part of the shared contract:

- list responses use `{ manifests: ModuleCapabilityManifest[] }`;
- single-module responses use `{ manifest: ModuleCapabilityManifest }`.

With password auth enabled, super admins may list all module capability
manifests. Module users may read only modules they can access. Without password
auth, the endpoints follow the existing local API behavior and return metadata.

The response body must contain manifest metadata only. It must not contain report
rows, raw payloads, direct SQLite details, Bitrix secrets, or personal fields.

## Data Policy

Every manifest must include a data policy:

- `allowedScopes` names the safe module-owned scopes available to platform
  consumers;
- `forbiddenFields` names excluded personal or raw fields;
- `piiExcluded` must be true for reporting manifests;
- `rawPayloadAccess`, `directBitrixAccess`, and `arbitrarySqliteAccess` must be
  false.

This keeps the manifest useful for custom module and AI-agent planning
without granting broad storage access.
