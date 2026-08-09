# Plan 043: Clarify messenger author attribution

> Delivery: GitHub issue #149.

## Outcome

Make the Activities messenger summary and reader distinguish a proven message
author from the manager who is operationally responsible for the owning deal.
Incoming WAZZUP/Umnico rows must be labelled as client messages; ambiguous
outgoing rows must remain visible under the responsible manager without
claiming that manager as the physical sender.

## Change Classification And Authority

- Class: correction of a representation that currently overstates the meaning
  of the connector token `Телефон`; the accepted attribution model itself does
  not change.
- Decision owner: product owner, through the production browser comment on
  2026-08-09 and issue #149.
- Canonical model version: unchanged. ADR 0006 remains the accepted source of
  truth, so no new `version_id` or element identity is introduced.
- Active instances: existing stored messages are not rewritten. The corrected
  labels are derived when the protected reader response is built and rendered.

## Scope And Non-goals

In scope: expose whether a manager author was confirmed for each reader item,
render distinct labels for confirmed outgoing, responsible-manager outgoing,
incoming client, and unknown direction; update summary wording, tests, and the
messenger reporting documentation; release and verify the production dialog.

Not in scope: changing `author_manager_id`, treating the deal or activity owner
as proof of physical authorship, changing message counts or manager scope,
reclassifying direction, storing new personal data, exposing message text in
aggregates/logs, or integrating a provider-specific WAZZUP API.

## Sources And Authority

- GitHub issue #149 and the product-owner browser comment.
- ADR 0006 and `MESSAGE_METRICS_RESEARCH.md`.
- Current domain classification, SQLite rows, collection service, API client,
  Activities messenger section, and reader.
- Sanitized production evidence for session `32984`: activity
  `RESPONSIBLE_ID = 13020`, while incoming and outgoing rows share connector
  sender ID `14492`; the outgoing marker supplies only author token `Телефон`.

## Decisions Already Made

- `authorManagerId !== null` is the only existing proof that a whitelist
  manager is the message author.
- An unresolved outgoing message remains operationally scoped to the current
  deal manager, but its UI label says `Ответственный`, not `Автор`.
- A supported-provider incoming row says `Клиент` because direction is proven
  by the provider rule; this does not identify or persist the client.
- Aggregate values and asymmetric attribution remain unchanged. Only their
  explanation and reader labels change.

## Critical Unknowns

- Bitrix Open Lines history does not identify the physical WAZZUP sender when
  the embedded marker contains only `Телефон`.
- Open Lines `RESPONSIBLE_ID` and deal `ASSIGNED_BY_ID` can differ and neither
  proves the human sender. A provider-level identity source would require a
  separate discovery and privacy decision.

## Impact Map

| Dependency | Action | Reason |
| --- | --- | --- |
| Domain parser and SQLite derived fields | Verify unchanged | Direction and confirmed author resolution are already correct. |
| Reader service contract | Change | Add an explicit `authorConfirmed` boolean derived from `authorManagerId`. |
| Web API normalizer and types | Change | Preserve the explicit contract; do not infer from label text in the browser. |
| Reader labels | Change | Show author, responsible manager, client, or unknown direction accurately. |
| Activities summary wording | Change | Replace misleading `Автор не определён` wording with operational attribution language. |
| Aggregates, manager filters, attachment access, privacy | Verify unchanged | No count, scope, body, or authorization change is allowed. |
| ADR/research/backlog | Update | Keep the accepted rule and its current representation aligned. |

## Work Packets

1. Contract and service
   - Owns: `apps/api/src/server/messenger-message-collection.ts` and focused API
     tests.
   - Output: reader items expose `authorConfirmed` from the stored resolved
     author ID.
   - Verification: confirmed and unresolved outgoing fixtures plus incoming.
   - Stop: if implementation requires exposing raw sender IDs or message bodies
     outside the existing leader reader.
2. Web representation
   - Owns: dashboard types, API normalization, messenger reader, Activities
     messenger section, and focused tests.
   - Output: explicit labels and non-misleading summary copy.
   - Dependency: packet 1.
   - Verification: rendered labels, no `Телефон` presented as a person, keyboard
     and responsive reader behavior unchanged.
3. Contract writeback
   - Owns: ADR 0006, message research note, backlog, this plan.
   - Output: representation rule and source limitation are durable.
   - Verification: ontology validation and documentation review.
4. Release and live proof
   - Owns: full checks, final correctness/security boundary review, commit, PR/CI,
     deploy, sanitized API and browser verification, issue evidence.
   - Stop: on changed counts, widened access, lost message text, or a label that
     claims unproven physical authorship.

## Validation

- Focused API collection/HTTP and web API-client/reader/Activities tests.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm ontology:validate`.
- Final diff/CRG review plus correctness and security boundary review.
- Production: session `32984` shows unresolved outgoing rows as responsible to
  Илья and incoming rows as client messages; aggregate counts remain unchanged;
  browser console has no warnings or errors.

## Recovery And Rollback

The change is code and documentation only. Reverting its focused commit restores
the previous labels and response field. SQLite rows and raw text are untouched,
so no backup, data migration, or restore is required.

## Done Criteria

- The reader never renders generic token `Телефон` as a human author.
- Confirmed outgoing, responsible-manager outgoing, incoming client, and unknown
  direction labels are covered by tests and visible as designed.
- Summary wording matches ADR 0006 without changing any metric value.
- Full checks and final reviews pass; PR is merged; production API/UI and
  issue #149 contain verification evidence.

## Completion Evidence

- Implemented as PR #150 with no database or aggregate-value changes.
- Local focused and full test suites, typecheck, lint, ontology validation, and
  diff checks passed on 2026-08-09; both GitHub CI runs passed.
- Sanitized production API/UI verification and release evidence are recorded in
  issue #149 after the merge-and-deploy workflow.
