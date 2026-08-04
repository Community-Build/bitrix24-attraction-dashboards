# Plan 039: Messenger direction, deal links, and attachments

> Superseded on 2026-08-04 by ADR 0006 and plan 040 for current runtime behavior.
> This completed plan remains as implementation history.

## Outcome

Use the direction evidence embedded by WAZZUP in Open Lines message text to
show and count outgoing messages accurately, keep unsupported connector
messages explicit as unknown, open the owning Bitrix deal from the reader, and
let an authorized leader download a validated attachment without exposing a
Bitrix webhook URL.

## Scope And Non-Goals

In scope: WAZZUP outgoing/system marker parsing, cleaned reader text, outgoing
and incoming aggregates, unique outgoing dialog/deal coverage, safe Bitrix
deal links, attachment file-id normalization, a leader-only validated binary
download route, UI controls, tests, and contract documentation.

Out of scope: persisting message bodies or files, image/document previews,
provider writes, inferring direction for OLChat or Umnico without evidence,
contact identity matching, and production deployment.

## Sources And Authority

- Browser evidence in session `34842` establishes the observed WAZZUP marker
  semantics.
- A read-only Bitrix check found 35 messages in that session: 21 outgoing
  markers, 13 unmarked incoming messages, one `SYSTEM WZ` event, and seven
  outgoing messages with file IDs.
- `docs/modules/attraction/MESSAGE_METRICS_RESEARCH.md` owns the durable source
  evidence and limitations.
- Current attraction deal scope and manager whitelist remain the access scope.

## Decisions Already Made

- A WAZZUP message beginning with `=== Исходящее сообщение ... ===` is
  outgoing. Its service header is removed from displayed body text and its
  author label is retained separately.
- An unmarked WAZZUP connector message is incoming. Other connector families
  remain `unknown` until independently verified.
- WAZZUP `SYSTEM WZ` rows and Bitrix `senderid = 0` rows are excluded.
- The primary Activities metrics become outgoing messages, unique dialogs with
  outgoing messages, deals with outgoing messages, and incoming messages.
- Attachment download is proxied through this API after re-validating manager,
  date range, session, message, and file ID. Raw Bitrix download URLs never
  reach the browser or logs.

## Critical Unknowns

- OLChat and Umnico direction encoding remains unknown.
- An Open Lines session is not guaranteed to equal one real person, so unique
  recipients remain disclosed as unique dialogs rather than unique people.

## Boundaries And Contracts

- Reader and attachment routes remain leader-only, no-store, one manager, and
  at most 31 days.
- Attachment download accepts only a file ID present on the exact collected
  message and caps the proxied payload at 20 MiB.
- Attachment responses use `application/octet-stream`, attachment disposition,
  and `nosniff`; no inline HTML/media execution is allowed.
- Deal links use the configured Bitrix portal host plus an encoded numeric deal
  ID and contain no webhook credential.

## Work Packets

1. Normalize attachment IDs and implement bounded Bitrix disk download.
2. Parse WAZZUP direction/system headers and expose outgoing aggregates.
3. Add the protected attachment HTTP boundary and web client.
4. Update Activities metrics and the reader direction/link/attachment UI.
5. Update evidence/ontology/report contracts and verify source, tests, build,
   browser behavior, and final diff.

## Validation

- Focused Bitrix, collection service, HTTP, API-client, Activities, and reader
  tests.
- API/web lint, typecheck, full suites, build, and ontology validation.
- Desktop/mobile browser review with a real WAZZUP reader session, deal link,
  cleaned direction labels, attachment control, keyboard focus, and console.
- CRG change detection and final staged-diff review.

## Recovery And Rollback

No migration or persistence is introduced. Reverting the focused follow-up
commit restores aggregate-only direction handling and non-downloadable
attachment badges.

## Done Criteria

- WAZZUP outgoing, incoming, and system rows are classified as specified.
- Outgoing totals and unique dialog/deal counts match the parsed message set.
- Service headers are absent from displayed text.
- Deal links open the correct configured Bitrix deal.
- Only an authorized, in-scope message attachment can be downloaded and no
  Bitrix download/webhook URL is exposed.
- Tests, build, ontology validation, browser review, and clean commit pass.

## Completion Evidence

- Focused verification passed: 127 API tests and 47 web tests.
- Workspace typecheck, lint, ontology validation, and production build passed.
- The initial full workspace run hit the unrelated `stand-data` 20-second
  timeout under parallel load. Its isolated rerun passed in 2.98 seconds, and
  the bounded full API rerun passed all 637 tests. All 187 web tests and 11
  prototype tests passed.
- A read-only local Bitrix audit for `2026-07-04` through `2026-08-03` found
  612 retained messages: 295 WAZZUP outgoing, 208 WAZZUP incoming, and 109
  OLChat/Umnico messages whose direction remains unknown.
- The real attachment proxy returned a 42,244-byte file with
  `application/octet-stream`, attachment disposition, `nosniff`, and no
  credential-bearing URL in the response.
- Desktop and mobile browser checks confirmed outgoing/incoming labels,
  stripped WAZZUP service headers, a correct Bitrix deal link, attachment
  controls, responsive layout, and no console warnings or errors.
