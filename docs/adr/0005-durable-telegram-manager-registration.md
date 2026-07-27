# ADR 0005: Durable Telegram manager registration

## Status

Accepted

## Context

Deal-routing notifications need a stable `Bitrix user ID -> Telegram private
chat ID` mapping. Telegram Bot API does not expose a historical subscriber list,
and consumed `/start` updates cannot be queried again. Static environment
variables therefore lose new activations.

The existing attraction Telegram bot already has one webhook for call
enrichment callbacks. Telegram supports only one webhook URL per bot, so a
second independent Telegram trigger would replace the approval webhook.

Telegram cannot prove which Bitrix employee owns a Telegram account. The
operator has decided to perform this match manually once rather than encode
Bitrix identity into personalized bot links.

## Options

1. Keep asking managers for chat IDs and manually updating n8n without a
   persistent intake registry.
2. Move the bot webhook to n8n and proxy existing call-enrichment callbacks.
3. Keep the dashboard API as the single webhook owner, save every private
   `/start`, and manually match each saved account to a Bitrix user once.

## Decision

Keep the dashboard API as the single Telegram webhook owner.

The webhook accepts `message` and `callback_query` updates, verifies Telegram's
webhook secret, and saves every private `/start` in
`telegram_manager_registrations`. It stores Telegram chat/user IDs, username,
display names, and first/last seen timestamps. A repeated `/start` refreshes the
Telegram metadata without erasing an existing manual Bitrix match.

An operator compares the saved Telegram identity with the Bitrix manager roster
and writes `bitrix_user_id` once. Only matched active rows are exposed through
`GET /api/telegram/registrations`. That endpoint requires a separate export
secret and returns only the fields needed by deal routing.

The n8n workflow reads the protected export and merges it with the existing
Data Table mappings. The Data Table remains a fallback when the dashboard
endpoint is temporarily unavailable.

## Consequences

- Managers use the normal bot link and press Start; no personalized link is
  required.
- New activations are not lost and can be inspected later.
- A new account receives deal notifications only after the one-time manual
  Bitrix match.
- Deal assignment continues if the registration export is unavailable; only a
  notification without a fallback mapping is skipped.
- The registration table contains Telegram identity data and stays outside
  reporting, MCP, and browser APIs.
- Rotating the export secret requires updating the n8n credential in the same
  rollout.

## Revisit Conditions

Revisit this decision if a self-service identity proof becomes available, if
notifications move out of n8n, or if operators need a dedicated matching UI.
