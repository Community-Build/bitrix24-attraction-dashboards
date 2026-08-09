# Plan 044: Show messenger attachment download failures inline

> Delivery: GitHub issue #151.

## Outcome

Make a failed messenger attachment download visible beside the exact control
that initiated it and offer an explicit retry. After a successful response,
retain a visible real download link so browsers that block the best-effort
automatic Blob click still let the operator save the file. Preserve every
authorization, scope, size, and privacy boundary.

## Change Classification And Authority

- Class: correction of an operator-facing failure state; the attachment access
  model and source integration do not change.
- Decision owner: product owner, through the production browser comment on
  2026-08-09 and issue #151.
- Active instances: no stored message or file rows are changed. The corrected
  state exists only in the leader's browser after a failed request.

## Scope And Non-goals

In scope: translate the stable attachment API failure codes into concise
Russian messages, render the last failure adjacent to the selected attachment,
offer retry, retain one visible prepared-file download link after success,
revoke replaced/closed Blob URLs, cover success and failure with focused tests,
and verify the exact production message after release.

Not in scope: changing Bitrix webhook/app permissions or credentials, adding a
provider integration, weakening the leader-only reader, bypassing message/file
scope validation, increasing the 20 MiB cap, persisting errors or file data, or
changing aggregate message metrics.

## Sources And Authority

- GitHub issue #151 and the production browser comment.
- Current protected attachment route and collection service.
- Current web reader and API client.
- Sanitized live evidence for manager `11234`, session `34830`, message
  `3280160`, file `357012`: the first probe returned 502 with Bitrix
  `ACCESS_DENIED`; after release the same endpoint returned 200/19,543 bytes,
  but the in-app browser emitted no download event for the asynchronous hidden
  anchor click.

## Decisions Already Made

- A source permission failure must be represented honestly, not as a successful
  download or an inert button.
- Error feedback belongs beside the attachment action because the reader is a
  long independently scrolling drawer.
- A successful API response must not rely only on a synthetic click after an
  asynchronous fetch. The automatic attempt remains best-effort and a visible
  `<a download>` provides a new trusted user gesture.
- `ATTACHMENT_UNAVAILABLE`, `ATTACHMENT_NOT_FOUND`, and
  `ATTACHMENT_TOO_LARGE` receive distinct messages; unknown failures receive a
  safe generic retry message.
- Actual access to the blocked file is a separate integration-permission change
  requiring explicit authorization.

## Critical Unknowns

- Bitrix file access was inconsistent across live probes. The UI must represent
  both source failure and source success correctly; expanding credential scope
  remains a separately authorized change if `ACCESS_DENIED` recurs.

## Boundaries And Contracts

| Boundary | Required behavior |
| --- | --- |
| Authorization | Keep the leader-only reader and attachment route unchanged. |
| Scope | Keep manager, date, session, message, and file validation unchanged. |
| Privacy | Do not expose raw URLs, credentials, payloads, or message bodies outside the existing reader. |
| Resource limit | Keep the 20 MiB bounded proxy and no-store response behavior. |
| UI state | Associate the visible failure with one exact attachment key and clear it before retry or reader reload. |
| Browser download | Keep at most one prepared Blob URL, expose it through a real link, and revoke it on replacement, reload, close, or unmount. |

## Work Packets

1. Web failure state
   - Owns: `apps/web/src/proto/messenger-message-reader.tsx`.
   - Output: stable error-code copy, adjacent alert, retry action, visible
     prepared-file link, and bounded Blob URL lifecycle.
   - Stop: if the change requires widening API access or browser-side direct
     Bitrix/provider URLs.
2. Focused verification
   - Owns: `apps/web/src/proto/messenger-message-reader.test.tsx`.
   - Output: regression coverage for a failed selected attachment plus the
     existing successful Blob download path.
3. Durable writeback and release
   - Owns: backlog, this plan, checks, commit, PR/CI/deploy, and sanitized live
     proof.
   - Stop: on altered server authorization, response data, message counts, or
     privacy behavior.

## Validation

- Focused messenger reader test and full web suite.
- `pnpm typecheck`, `pnpm lint`, and `pnpm ontology:validate`.
- Final diff/CRG review of the scoped frontend and documentation change.
- Production: clicking the exact 2026-07-17 12:36 attachment either shows an
  inline source-access message and retry or prepares a visible real link; a
  trusted click on that link saves the named file; browser console stays clean.

## Recovery And Rollback

The change is frontend state and documentation only. Reverting the focused
commit restores the prior error placement. No database backup, migration, or
data restore is required.

## Done Criteria

- A failed attachment request no longer appears to do nothing.
- The error is visible beside the exact selected attachment and offers retry.
- Stable server codes have actionable Russian messages and unknown failures
  have a safe fallback.
- Successful responses expose a real downloadable link and revoke its Blob URL
  when it is no longer usable.
- Checks and review pass; PR is merged; production and issue #151 contain
  sanitized verification evidence.

## Completion Evidence

- PR #152 added adjacent failure messages, stable Russian error copy, and an
  explicit retry; PR #153 retained a visible real download link after a
  successful protected response.
- GitHub Actions run `31318105938` passed lint, typecheck, tests, build, and the
  production deploy. Production runs commit
  `2f8eac000a77311d195092d9cb68304f703b73a7`; health is green, the app remains
  non-root, and the protected endpoint rejects anonymous access with 401.
- The exact production request for manager `11234`, session `34830`, message
  `3280160`, file `357012` returned 200 with 19,543 binary bytes.
- At 612px viewport, the exact 2026-07-17 12:36 message exposed the visible
  ready state and a download link named
  `Карточка_ООО_ФНБ_Инжиниринг.docx`. The automatic attempt and the trusted
  visible-link click each saved a 19,543-byte file. The browser-control bridge
  did not surface its download event, so filesystem evidence was used to
  verify the actual result.
