# Attraction Message Metrics Research

Date: `2026-05-24`

Implementation update: `2026-08-04`

This note records the current Bitrix24 / Open Lines findings for future message
metric implementation in the attraction module.

## Confirmed Access

- The production webhook now has `imopenlines` scope in addition to `crm`.
- `imopenlines.crm.chat.get`, `imopenlines.dialog.get`, and
  `imopenlines.session.history.get` are available.
- `im.dialog.messages.get` is still blocked with `insufficient_scope`; plain
  `im.*` methods are not available to the webhook.
- For message counts, `im` scope is not required yet: `imopenlines.session.history.get`
  returns a `message` object whose keys can be counted without persisting message text.

## Safe Counting Model

Use `crm.activity.list` with `PROVIDER_ID = IMOPENLINES_SESSION` as the entrypoint.
For period queries, filter candidate activities by `LAST_UPDATED` and then filter
individual history messages by their own `date`.

Safe message fields for local persistence:

- Bitrix message id;
- chat id;
- session id;
- message date;
- CRM owner type/id;
- activity id;
- responsible manager id;
- source/integration/channel;
- direction bucket;
- file/attachment presence as a boolean if needed.

Do not persist or expose through aggregate reports, MCP, logs, or comments:

- message text or `textlegacy` (the explicit bounded leader reader described
  below is the only HTTP exception and uses `no-store`);
- raw attachments;
- contact names, phones, emails, avatars, URLs, or raw Bitrix payloads.

System messages must be excluded from business counts:

- `senderid = 0` means Bitrix/Open Lines system event.

Current provisional direction buckets:

- `connector`: `users[senderid].connector = true`.
- `operator`: sender is a regular Bitrix user.
- `system`: `senderid = 0`.

Important limitation: `connector` is not the same as "received from client" in all
cases. If a manager sends from Wazzup, Telegram, Max, or another external client
outside Bitrix, Bitrix may still record the message as an `imconnector` user.
Therefore Bitrix-only data can reliably count non-system Open Lines messages, but
cannot yet reliably split all messages into `sent` vs `received`.

## Source And Channel Mapping

Use `imopenlines.crm.chat.get` and/or `imopenlines.session.history.get.result.chat`
to identify the connector. The useful fields are connector title and chat
`entityId`.

Observed source patterns:

- `olchat_tg_connector` -> `OLChat: Telegram`;
- `olchat_wa_connector_2` -> `OLChat: WhatsApp`;
- `wz_telegram...` -> `WAZZUP: Telegram`;
- `wz_max...` -> `WAZZUP: Max`;
- future Wazzup WhatsApp should be mapped from a `wz_*whatsapp*` or `wz_*wa*`
  connector pattern when it appears.

The source/channel mapping should be centralized before any report uses it.

## Manager Attribution

Two attribution modes were checked:

- by Open Lines activity `RESPONSIBLE_ID`;
- by attraction deal `ASSIGNED_BY_ID`, using the activity CRM owner deal or the
  latest matching attraction deal for contact-owned activities.

These produce different totals. For attraction sales/reporting, the recommended
default is attribution by attraction deal responsible. Keep activity responsible
as an audit/debug dimension because Open Lines ownership can differ from deal
ownership.

## Read-Only Production Sample

Period checked: `2026-05-17T00:00:00+03:00` through `2026-05-24T13:05`
Europe/Istanbul.

By attraction deal responsible:

- external connector messages: `75`;
- Bitrix user/operator messages: `0`;
- system messages excluded: `121`;
- sessions checked: `26`.

By source:

- `OLChat: Telegram`: `41`;
- `WAZZUP: Max`: `15`;
- `WAZZUP: Telegram`: `15`;
- `OLChat: WhatsApp`: `4`.

By manager:

- `78` / Egorov Andrey: `15`, all `WAZZUP: Max`;
- `6994` / Kuznetsova Anastasia: `18`, all `OLChat: Telegram`;
- `72` / Krokhaleva Maria: `1`, all `OLChat: Telegram`;
- `2236` / Potapova Maria: `39`, split across `OLChat: Telegram`,
  `WAZZUP: Telegram`, and `OLChat: WhatsApp`;
- `13020` / Kakulia Ilya: `2`, all `OLChat: WhatsApp`.

By Open Lines activity responsible, the same period yielded:

- external connector messages: `91`;
- Bitrix user/operator messages: `0`;
- system messages excluded: `181`;
- sessions checked: `32`;
- sources: `OLChat: Telegram` `89`, `OLChat: WhatsApp` `2`.

## Implementation Implications

- A Bitrix-only V1 can show "non-system Open Lines messages" by manager/source.
- Observed WAZZUP Open Lines histories carry a stable text marker for outgoing
  messages: `=== Исходящее сообщение ... ===`. The reader removes this service
  header and keeps its author label separately. An unmarked WAZZUP row is
  treated as incoming; `=== SYSTEM WZ ===` is excluded.
- This evidence does not generalize to OLChat or Umnico. Their connector rows
  remain `unknown` until a provider-specific direction field is verified.
- If `im` scope is later added, `im.dialog.messages.get` can be tested as an
  alternate message-history source, but it should follow the same privacy rule:
  count metadata only, never persist message text.

## Implemented Transient Collection Boundary

- `POST /api/messenger-messages/collect` is an on-demand attraction runtime
  operation, not a dashboard report. With password auth enabled it is available
  only to attraction leaders; production auth remains mandatory.
- One request selects one enabled manager and no more than 31 days. Deal scope
  comes from `attraction_current_deal_ids`, and attribution uses the current
  attraction deal `ASSIGNED_BY_ID`.
- `crm.activity.list` locates `IMOPENLINES_SESSION` activities and
  `imopenlines.session.history.get` returns the session body. Complete `text`
  exists only inside the collection call and may be passed to an injected
  server-side analyzer.
- The HTTP response contains only message/session/deal counts, text coverage,
  attachment-only count, channels, and sender-kind totals. It never returns raw
  text, `textlegacy`, attachments, user names, contact data, or raw payloads.
- The collector does not write SQLite and does not log response bodies.
- WAZZUP direction is parsed from its embedded marker. Unmarked WAZZUP rows are
  incoming, operator-authored Bitrix rows are outgoing, and unsupported
  connector families keep `direction = unknown`.
- No semantic scoring rubric or model provider is selected in this change. The
  implemented boundary supplies safe input for that next decision.

## Implemented Activities Summary And Reader

- The Activities screen has a leader-only messenger section. It uses the
  selected date and manager filters but performs no Bitrix read until the user
  explicitly starts the calculation.
- `POST /api/messenger-messages/summary` collects all selected enabled managers
  in one pass and returns no raw text. Its primary metrics are outgoing
  messages, unique Open Lines sessions with outgoing messages, unique deal IDs
  with outgoing messages, and incoming messages. It also reports unknown
  direction, total non-system coverage, channels, and manager rows.
- `Unique dialogs` means distinct Open Lines session IDs with a retained message;
  `deals with messages` is separate. Neither metric is presented as unique real
  people because provider-level identity is not available reliably.
- `POST /api/messenger-messages/read` accepts one enabled manager, no more than
  31 days, and at most 500 newest messages. It returns safe IDs, timestamp,
  channel, parsed direction/author, a configured-portal deal link, attachment
  IDs, and cleaned full text with `Cache-Control: no-store`.
- `POST /api/messenger-messages/attachment` re-collects that exact manager,
  range, session, message, and file ID before proxying at most 20 MiB as
  `application/octet-stream`. It never returns the credential-bearing Bitrix
  download URL and does not persist the file.
- The reader omits chat/contact/deal names, phones, emails, avatars, and raw
  Bitrix payloads. The web client renders text as a plain React text node and
  never interprets conversation content as HTML.
- Summary, reader, and attachment routes require attraction leader access
  before any Bitrix call. Text and files are not written to SQLite, logs, MCP,
  comments, or report state.

## Direction Coverage Validation

Local read-only validation on `2026-08-04` used the range
`2026-07-04T00:00:00+03:00` through `2026-08-03T23:59:59+03:00` and the current
attraction scope. After excluding one embedded `SYSTEM WZ` row, `612`
non-system messages remained: `295` outgoing, `208` incoming, and `109` with
unsupported direction. No message body was printed or persisted.

| Manager | Outgoing | Incoming | Unknown | Direction coverage |
| --- | ---: | ---: | ---: | --- |
| `78` / Егоров Андрей | 0 | 0 | 74 | unavailable: Umnico/OLChat only |
| `11234` / Ромашова Ольга | 219 | 132 | 4 | WAZZUP covered; 4 OLChat rows unknown |
| `6994` / Кузнецова Анастасия | 0 | 0 | 25 | unavailable: OLChat only |
| `2236` / Потапова Мария | 0 | 0 | 4 | unavailable: OLChat only |
| `2764` / Каньков Вячеслав | 0 | 0 | 2 | unavailable: OLChat only |
| `13020` / Какулия Илья | 49 | 41 | 0 | covered: WAZZUP |
| `7538` / Мария Саличева | 27 | 35 | 0 | covered: WAZZUP |
| `118` / Аделия Космасова | 0 | 0 | 0 | no messages in range |

This table describes direction coverage, not text availability. Unsupported
OLChat/Umnico message text is still available to the transient reader and an
in-process analyzer, but it must not be counted as manager-sent until provider
direction evidence exists.

## Read-Only Production Coverage Audit

Period checked: `2026-07-04T00:00:00+03:00` through
`2026-08-03T23:59:59+03:00`. The audit used the eight currently enabled
attraction managers and `3,562` current Bitrix attraction deals. Raw message
text was held only in process memory and was not printed or persisted.

Across all managers, the collector found `613` non-system messages in `112`
Open Lines sessions. Complete text was available for `603` messages; the other
`10` were attachment-only. Another `426` Bitrix system events were excluded.

| Manager | Sessions | Messages | With text | Attachment only | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| `78` / Егоров Андрей | 17 | 74 | 74 | 0 | analyzable |
| `11234` / Ромашова Ольга | 46 | 356 | 349 | 7 | analyzable |
| `6994` / Кузнецова Анастасия | 19 | 25 | 25 | 0 | analyzable |
| `2236` / Потапова Мария | 1 | 4 | 4 | 0 | analyzable |
| `2764` / Каньков Вячеслав | 1 | 2 | 2 | 0 | analyzable |
| `13020` / Какулия Илья | 24 | 90 | 89 | 1 | analyzable |
| `7538` / Мария Саличева | 4 | 62 | 60 | 2 | analyzable |
| `118` / Аделия Космасова | 0 | 0 | 0 | 0 | no messages in period |

The zero row for Аделия Космасова is not an API-access failure: the manager has
current attraction deals, but no matching Open Lines sessions were found in the
selected period. Content analysis is therefore possible for seven managers in
this window and has no material to process for the eighth.

Production also confirmed that `chat`, `message`, and `users` are ID-indexed
objects rather than arrays. The adapter regression test now covers that response
shape. Channel mapping resolved Umnico Telegram, WAZZUP Telegram/Max, and OLChat
Telegram/WhatsApp without exposing conversation content.
