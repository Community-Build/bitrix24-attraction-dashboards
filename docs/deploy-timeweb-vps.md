# Production Deploy: Timeweb VPS

This runbook deploys the dashboard as one closed web application: Express serves `/api/*` and `apps/web/dist` on a localhost-only port, while the public internet reaches only the reverse proxy over HTTPS.

## Target Layout

- Public URL: `https://<new-subdomain>`
- App process: Docker container running as non-root user `10001:10001`
- Internal app port: `127.0.0.1:8787`
- Platform/auth/comments SQLite data: `/opt/bitrix24-reporting/data/bitrix24-reporting.db`
- Attraction sync SQLite data: `/opt/bitrix24-reporting/data/bitrix24-attraction.db`
- Leadgen sync SQLite data: `/opt/bitrix24-reporting/data/bitrix24-leadgen.db`
- Secrets: repo-local `.env.production`, mode `0600`, owned by deploy/app user
- No web root points at the repository, `apps/api/data`, backups, `.env`, or `.codex`

## 1. VPS Inventory

Run before changing proxy or firewall state:

```bash
hostnamectl
id
sudo ss -tulpn | grep -E ':(80|443|8787)\b' || true
sudo systemctl status nginx --no-pager || true
sudo systemctl status caddy --no-pager || true
sudo systemctl status docker --no-pager || true
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' || true
sudo ufw status verbose || true
sudo firewall-cmd --list-all || true
```

If nginx or Caddy already owns `80/443`, add only a new vhost/site for the subdomain. Do not replace existing configs.

## 2. Prepare Files And Permissions

```bash
sudo install -d -o 10001 -g 10001 -m 700 /opt/bitrix24-reporting/data
sudo install -d -o "$USER" -g "$USER" -m 755 /opt/bitrix24-reporting/app
cd /opt/bitrix24-reporting/app
git clone <repo-url> .
git switch main
git pull --ff-only
```

Create `.env.production`:

```bash
cat > .env.production <<'ENV'
NODE_ENV=production
AUTH_MODE=password
SESSION_SECRET=<64+ random chars>
SESSION_COOKIE_NAME=b24dash_session
SESSION_TTL_HOURS=12
APP_PUBLIC_URL=https://<new-subdomain>
WEB_ORIGIN=https://<new-subdomain>
TRUST_PROXY=loopback
API_HOST=0.0.0.0
API_PORT=8787
WEB_STATIC_DIR=/app/apps/web/dist
DATABASE_URL=file:/app/data/bitrix24-reporting.db
PLATFORM_DATABASE_URL=file:/app/data/bitrix24-reporting.db
ATTRACTION_DATABASE_URL=file:/app/data/bitrix24-attraction.db
# Legacy until the ADR 0003 leadgen removal migration.
LEADGEN_DATABASE_URL=file:/app/data/bitrix24-leadgen.db
JSON_BODY_LIMIT=256kb
ATTRACTION_AUTO_SYNC_ENABLED=true
ATTRACTION_AUTO_SYNC_INTERVAL_MINUTES=60
TELEGRAM_ACTIVITY_REPORT_ENABLED=false
TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN=<telegram-bot-token>
TELEGRAM_ACTIVITY_REPORT_CHAT_ID=<telegram-chat-id>
TELEGRAM_ACTIVITY_REPORT_CHAT_IDS=<telegram-chat-id-1>,<telegram-chat-id-2>
TELEGRAM_ACTIVITY_REPORT_TEAM_CHAT_IDS=<team-id>:<telegram-chat-id>
TELEGRAM_ACTIVITY_REPORT_TIME=20:00
CALL_ENRICHMENT_MODE=off
CALL_ENRICHMENT_PILOT_MANAGER_IDS=
CALL_ENRICHMENT_EXPIRY_INTERVAL_MINUTES=60
BITRIX_CALL_EVENT_WEBHOOK_SECRET=<32+ random chars>
TELEGRAM_ENRICHMENT_BOT_TOKEN=<telegram-bot-token>
TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS=<bitrix-user-id>:<telegram-chat-id>
TELEGRAM_ENRICHMENT_CALLBACK_SECRET=<32+ random chars>
TELEGRAM_MANAGER_REGISTRATION_ENABLED=false
TELEGRAM_MANAGER_REGISTRATION_EXPORT_SECRET=<32+ random chars>

BITRIX24_PORTAL_HOST=<portal>.bitrix24.ru
BITRIX24_WEBHOOK_USER_ID=<user-id>
BITRIX24_WEBHOOK_TOKEN=<token>
BITRIX24_DEAL_CATEGORY_IDS=10
# Legacy until the ADR 0003 leadgen removal migration.
BITRIX24_LEADGEN_US_CATEGORY_ID=28
BITRIX24_LEADGEN_MANAGER_IDS=8244,84,11620,11486,12028,11610
REPORT_WON_STAGE_IDS=C10:WON
REPORT_DEFAULT_PERIOD_DAYS=30
ENV

chmod 600 .env.production
```

Generate `SESSION_SECRET` with `openssl rand -base64 48`.

Use the existing Telegram enrichment bot. Set its webhook with the same
`TELEGRAM_ENRICHMENT_CALLBACK_SECRET`; Telegram sends it back in
`X-Telegram-Bot-Api-Secret-Token`.

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_ENRICHMENT_BOT_TOKEN}/setWebhook" \
  -d "url=${APP_PUBLIC_URL}/api/telegram/enrichment/callback" \
  -d "secret_token=${TELEGRAM_ENRICHMENT_CALLBACK_SECRET}" \
  -d 'allowed_updates=["callback_query","message"]'
```

When `TELEGRAM_MANAGER_REGISTRATION_ENABLED=true`, send managers the regular
`https://t.me/<bot>` link and ask them to press Start. The API saves every
private activation; an operator matches the saved Telegram account to a Bitrix
user once. Configure n8n to read
`GET /api/telegram/registrations` with
`X-Telegram-Registration-Secret`.

### Call Enrichment Rollout

Keep `CALL_ENRICHMENT_MODE=off` by default. Enable the call enrichment feature in
separate phases:

1. Set `CALL_ENRICHMENT_MODE=dry_run`, deploy, and validate that call events
   create only analysis/proposal audit records.
2. Set `CALL_ENRICHMENT_MODE=telegram_only` and validate Telegram messages plus
   manager decisions. CRM fields are not written in this mode.
3. Set `CALL_ENRICHMENT_MODE=limited_write` with
   `CALL_ENRICHMENT_PILOT_MANAGER_IDS=<bitrix-user-id-1>,<bitrix-user-id-2>` and
   verify contact/deal field writes only for pilot managers.
4. Set `CALL_ENRICHMENT_MODE=full_v1` only after pilot review.

Rollback does not require a database migration: set `CALL_ENRICHMENT_MODE=off`
to stop intake/analysis, or `CALL_ENRICHMENT_MODE=telegram_only` to keep manager
decision logging while disabling CRM writes.

## 3. Build And Start

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app
```

Verify the non-secret database configuration before running sync:

```bash
docker compose exec app node -e "console.log({
  platform: process.env.PLATFORM_DATABASE_URL ?? process.env.DATABASE_URL,
  attraction: process.env.ATTRACTION_DATABASE_URL ?? 'file:./data/bitrix24-attraction.db',
  leadgen: process.env.LEADGEN_DATABASE_URL,
  leadgenManagers: (process.env.BITRIX24_LEADGEN_MANAGER_IDS ?? '').split(',').filter(Boolean).length
})"
docker compose exec app ls -lh /app/data
```

Create the first admin user through the compiled production CLI:

```bash
printf '%s\n' '<temporary-strong-password>' \
  | docker compose exec -T app \
    node --conditions=production apps/api/dist/tools/auth-users.js create admin --password-stdin
```

Reset and disable users:

```bash
printf '%s\n' '<new-password>' \
  | docker compose exec -T app \
    node --conditions=production apps/api/dist/tools/auth-users.js reset-password admin --password-stdin

docker compose exec -T app \
  node --conditions=production apps/api/dist/tools/auth-users.js disable admin
```

## 4. Reverse Proxy

### Existing Caddy

Add a server block:

```caddyfile
<new-subdomain> {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8787
}
```

Then:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Existing nginx

Add a site:

```nginx
server {
  listen 80;
  server_name <new-subdomain>;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name <new-subdomain>;

  ssl_certificate /etc/letsencrypt/live/<new-subdomain>/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/<new-subdomain>/privkey.pem;

  location ~ /\.(?!well-known) {
    deny all;
  }

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Issue the cert with your existing Certbot flow, then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### No Reverse Proxy Installed

Install Caddy and let it issue the certificate:

```bash
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
sudoedit /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 5. Health And Security Checks

```bash
curl -i https://<new-subdomain>/api/health
curl -i https://<new-subdomain>/api/dashboard
curl -i https://<new-subdomain>/.env.production
curl -i https://<new-subdomain>/.codex/
curl -i https://<new-subdomain>/apps/api/data/bitrix24-reporting.db
curl -i https://<new-subdomain>/apps/api/data/bitrix24-attraction.db
curl -i https://<new-subdomain>/apps/api/data/bitrix24-leadgen.db
curl -i http://127.0.0.1:8787/api/health
sudo ss -tulpn | grep 8787
docker compose exec -T app id
```

Expected:

- `/api/health` returns `200`.
- `/api/dashboard` returns `401` before login.
- dotfiles, `.env.production`, `.codex`, `apps/api/data`, backups and SQLite files are not served.
- `8787` is bound only to `127.0.0.1` on the host.
- Container user is not `root`.

From an external machine:

```bash
curl -m 3 http://<server-ip>:8787/api/health
```

Expected: connection fails or times out.

## 6. Update And Rollback

Update:

```bash
cd /opt/bitrix24-reporting/app
git fetch --all --prune
git switch main
git pull --ff-only
docker compose up -d --build
curl -i https://<new-subdomain>/api/health
```

Rollback to the previous commit:

```bash
cd /opt/bitrix24-reporting/app
git log --oneline -5
git switch --detach <previous-good-commit>
docker compose up -d --build
curl -i https://<new-subdomain>/api/health
```

Do not copy SQLite or backups into the repository or web root during rollback.
