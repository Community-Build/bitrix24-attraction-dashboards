#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${DEPLOY_APP_DIR:-/opt/bitrix24-reporting/app}"
DATA_DIR="${DEPLOY_DATA_DIR:-/opt/bitrix24-reporting/data}"
REPO_URL="${DEPLOY_REPO:?DEPLOY_REPO is required}"
DEPLOY_REF="${DEPLOY_REF:?DEPLOY_REF is required}"
COMPOSE_PROJECT="${DEPLOY_COMPOSE_PROJECT:-bitrix24-reporting}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-https://dashboardpriv.claricont.com/api/health}"
DASHBOARD_URL="${DEPLOY_DASHBOARD_URL:-https://dashboardpriv.claricont.com/api/dashboard}"
BACKUP_ROOT="${DEPLOY_BACKUP_ROOT:-/opt/bitrix24-reporting/backups/deploy}"
CADDYFILE="${DEPLOY_CADDYFILE:-/etc/caddy/Caddyfile}"

log() {
  printf '[deploy] %s\n' "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

public_host_from_url() {
  local url="$1"
  local host="${url#*://}"

  host="${host%%/*}"
  host="${host%%:*}"
  if [ "$host" = "$url" ]; then
    host=""
  fi

  printf '%s\n' "$host"
}

ensure_caddy_reverse_proxy() {
  local host="$1"
  local backup=""
  local changed="false"

  if ! command -v systemctl >/dev/null 2>&1; then
    log "Warning: systemctl unavailable; cannot manage Caddy"
    return 1
  fi

  install -d -m 755 "$(dirname "$CADDYFILE")"
  if [ ! -f "$CADDYFILE" ]; then
    : > "$CADDYFILE"
    changed="true"
  fi

  if ! grep -Fq "$host {" "$CADDYFILE"; then
    if [ "$changed" != "true" ]; then
      backup="${CADDYFILE}.bitrix24-reporting-$(date +%Y%m%d%H%M%S).bak"
      cp -p "$CADDYFILE" "$backup"
    fi

    {
      printf '\n%s {\n' "$host"
      printf '  encode zstd gzip\n'
      printf '  reverse_proxy 127.0.0.1:8787\n'
      printf '}\n'
    } >> "$CADDYFILE"
    changed="true"
    log "Added Caddy reverse proxy block for $host"
  fi

  if ! caddy validate --config "$CADDYFILE"; then
    if [ -n "$backup" ]; then
      cp -p "$backup" "$CADDYFILE"
    elif [ "$changed" = "true" ]; then
      rm -f "$CADDYFILE"
    fi
    return 1
  fi

  if systemctl is-active --quiet caddy; then
    systemctl reload caddy
  else
    systemctl enable --now caddy || systemctl start caddy
  fi
}

install_caddy_reverse_proxy() {
  local keyring="/usr/share/keyrings/caddy-stable-archive-keyring.gpg"
  local keyring_tmp="${keyring}.tmp"
  local source_list="/etc/apt/sources.list.d/caddy-stable.list"

  if [ "$(id -u)" != "0" ]; then
    log "Warning: Caddy installation requires root deploy user"
    return 1
  fi
  if ! command -v systemctl >/dev/null 2>&1; then
    log "Warning: systemctl unavailable; cannot install managed Caddy service"
    return 1
  fi
  if ! command -v apt-get >/dev/null 2>&1; then
    log "Warning: apt-get unavailable; cannot install Caddy reverse proxy"
    return 1
  fi

  log "No supported reverse proxy found; installing Caddy"
  if ! apt-get update; then
    return 1
  fi
  if ! DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    debian-keyring \
    debian-archive-keyring \
    apt-transport-https \
    ca-certificates \
    curl \
    gpg; then
    return 1
  fi
  if ! install -d -m 755 "$(dirname "$keyring")" "$(dirname "$source_list")"; then
    return 1
  fi

  rm -f "$keyring_tmp"
  if ! curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o "$keyring_tmp"; then
    rm -f "$keyring_tmp"
    return 1
  fi
  if ! mv "$keyring_tmp" "$keyring"; then
    rm -f "$keyring_tmp"
    return 1
  fi
  if ! chmod 644 "$keyring"; then
    return 1
  fi
  if ! curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    -o "$source_list"; then
    return 1
  fi
  if ! chmod 644 "$source_list"; then
    return 1
  fi

  if ! apt-get update; then
    return 1
  fi
  if ! DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends caddy; then
    return 1
  fi
  if ! command -v caddy >/dev/null 2>&1; then
    log "Warning: Caddy install completed but caddy command is unavailable"
    return 1
  fi
}

ensure_reverse_proxy() {
  local public_host

  public_host="$(public_host_from_url "$HEALTH_URL")"
  if [ -z "$public_host" ]; then
    log "Warning: could not infer public host from health URL"
    return 0
  fi

  if command -v caddy >/dev/null 2>&1; then
    ensure_caddy_reverse_proxy "$public_host"
    return
  fi

  if command -v nginx >/dev/null 2>&1 && command -v systemctl >/dev/null 2>&1; then
    log "Caddy unavailable; starting existing nginx reverse proxy"
    systemctl start nginx
    return $?
  fi

  if ! install_caddy_reverse_proxy; then
    return 1
  fi
  if ! ensure_caddy_reverse_proxy "$public_host"; then
    return 1
  fi
}

wait_for_http_code() {
  local url="$1"
  local expected="$2"
  local code

  for _ in $(seq 1 30); do
    code="$(curl -fsS -o /dev/null -w '%{http_code}' "$url" || true)"
    if [ "$code" = "$expected" ]; then
      return 0
    fi
    sleep 2
  done

  printf 'Expected %s from %s, got %s\n' "$expected" "$url" "${code:-none}" >&2
  return 1
}

start_compose_image() {
  local image="$1"
  local override
  local start_status=0

  [[ "$image" =~ ^sha256:[a-f0-9]{64}$ ]] || return 1
  override="$(mktemp)" || return 1
  if ! printf 'services:\n  app:\n    image: "%s"\n' "$image" > "$override"; then
    rm -f "$override"
    return 1
  fi
  docker compose -p "$COMPOSE_PROJECT" -f docker-compose.yml -f "$override" \
    up -d --no-build --remove-orphans app || start_status=$?
  rm -f "$override"
  return "$start_status"
}

build_compose_project() {
  local ref="$1"
  local build_status=0
  local image_name
  local image

  printf '%s\n' "$ref" > .docker-source-revision
  docker compose -p "$COMPOSE_PROJECT" build \
    --build-arg SOURCE_REVISION="$ref" \
    app || build_status=$?
  rm -f .docker-source-revision

  if [ "$build_status" -ne 0 ]; then
    return "$build_status"
  fi

  image_name="$(docker compose -p "$COMPOSE_PROJECT" config --images)" || return 1
  image="$(docker image inspect "$image_name" --format '{{.Id}}')" || return 1
  log "Release image $image for $ref"
  if ! docker run --rm --network none --entrypoint node "$image" -e \
    'const [major, minor] = process.versions.node.split(".").map(Number); if (major !== 24 || minor < 10) process.exit(1);'; then
    return 1
  fi
  start_compose_image "$image"
}

restore_previous_release() {
  local ref="$1"
  local image="$2"

  git reset --hard "$ref"
  git clean -fdx -e .env.production
  log "Restoring immutable image $image for $ref"
  start_compose_image "$image"
}

verify_image_revision() {
  local expected_ref="$1"
  local allow_missing="${2:-false}"
  local actual_ref

  actual_ref="$(
    docker compose -p "$COMPOSE_PROJECT" exec -T app \
      sh -c "cat /app/.build-revision 2>/dev/null || true" | tr -d "\r\n"
  )"

  if [ -z "$actual_ref" ] && [ "$allow_missing" = "true" ]; then
    log "Warning: running image has no build revision marker; accepting legacy rollback image"
    return 0
  fi

  if [ "$actual_ref" != "$expected_ref" ]; then
    printf 'Expected running image revision %s, got %s\n' "$expected_ref" "${actual_ref:-missing}" >&2
    return 1
  fi
}

clone_or_update_repo() {
  install -d -m 755 "$(dirname "$APP_DIR")"

  if [ ! -d "$APP_DIR/.git" ]; then
    local backup=""
    local env_backup=""

    if [ -d "$APP_DIR" ] && [ "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 | head -n 1)" ]; then
      install -d -m 700 "$BACKUP_ROOT"
      backup="$BACKUP_ROOT/app-before-git-$(date +%Y%m%d%H%M%S)"
      log "Moving existing non-git app directory to $backup"
      mv "$APP_DIR" "$backup"
      if [ -f "$backup/.env.production" ]; then
        env_backup="$backup/.env.production"
      fi
    fi

    log "Cloning repository"
    git clone "$REPO_URL" "$APP_DIR"

    if [ -n "$env_backup" ]; then
      cp "$env_backup" "$APP_DIR/.env.production"
      chmod 600 "$APP_DIR/.env.production"
    fi
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"
  local file="${3:-.env.production}"

  if [ -z "$value" ]; then
    return 0
  fi

  local tmp
  tmp="$(mktemp)"

  if grep -q "^${key}=" "$file"; then
    awk -v key="$key" -v value="$value" '
      $0 ~ "^" key "=" {
        print key "=" value
        next
      }
      { print }
    ' "$file" > "$tmp"
  else
    cat "$file" > "$tmp"
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi

  cat "$tmp" > "$file"
  rm -f "$tmp"
  chmod 600 "$file"
}

verify_runtime() {
  local expected_ref="$1"
  local allow_missing_revision="${2:-false}"

  if ! verify_image_revision "$expected_ref" "$allow_missing_revision"; then
    return 1
  fi
  if ! ensure_reverse_proxy; then
    return 1
  fi
  if ! wait_for_http_code "$HEALTH_URL" 200; then
    return 1
  fi

  local dashboard_code
  dashboard_code="$(curl -fsS -o /dev/null -w '%{http_code}' "$DASHBOARD_URL" || true)"
  if [ "$dashboard_code" != "401" ]; then
    printf 'Expected unauthenticated dashboard to return 401, got %s\n' "$dashboard_code" >&2
    return 1
  fi

  local app_uid
  if ! app_uid="$(docker compose -p "$COMPOSE_PROJECT" exec -T app id -u)"; then
    return 1
  fi
  if [ "$app_uid" = "0" ]; then
    printf 'App container is running as root\n' >&2
    return 1
  fi

  local published
  published="$(docker compose -p "$COMPOSE_PROJECT" ps --format json | grep -E '"PublishedPort":8787|"URL":"127.0.0.1"' || true)"
  if [ -z "$published" ]; then
    log "Warning: could not confirm localhost-only published port from compose JSON"
  fi
}

main() {
  require_command git
  require_command docker
  require_command curl

  install -d -o 10001 -g 10001 -m 700 "$DATA_DIR"
  clone_or_update_repo

  cd "$APP_DIR"

  if [ ! -f .env.production ]; then
    printf '%s/.env.production is missing\n' "$APP_DIR" >&2
    exit 1
  fi
  chmod 600 .env.production

  local previous_ref=""
  local previous_image=""
  local previous_container=""
  previous_ref="$(git rev-parse HEAD 2>/dev/null || true)"
  previous_container="$(docker compose -p "$COMPOSE_PROJECT" ps -q app)"
  if [ -n "$previous_container" ]; then
    previous_image="$(docker inspect "$previous_container" --format '{{.Image}}')" || return 1
    docker image tag "$previous_image" "$COMPOSE_PROJECT:rollback-${previous_ref:0:12}" || return 1
    log "Retained rollback image $previous_image for $previous_ref"
  fi

  log "Fetching $DEPLOY_REF"
  git fetch --prune origin
  git checkout -B main "$DEPLOY_REF"
  git reset --hard "$DEPLOY_REF"
  git clean -fdx -e .env.production

  if [ -n "${DEPLOY_MCP_ACCESS_TOKEN:-}" ]; then
    log "Updating MCP access token in production environment"
    set_env_value MCP_ACCESS_TOKEN "$DEPLOY_MCP_ACCESS_TOKEN" .env.production
  fi

  log "Building and starting compose project"
  if ! build_compose_project "$DEPLOY_REF"; then
    if [ -n "$previous_ref" ] && [ -n "$previous_image" ]; then
      log "Build/start failed, rolling back to $previous_ref"
      restore_previous_release "$previous_ref" "$previous_image"
    fi
    exit 1
  fi

  if ! verify_runtime "$DEPLOY_REF"; then
    if [ -n "$previous_ref" ] && [ -n "$previous_image" ]; then
      log "Runtime verification failed, rolling back to $previous_ref"
      restore_previous_release "$previous_ref" "$previous_image"
      verify_runtime "$previous_ref" true
    fi
    exit 1
  fi

  git rev-parse HEAD > .deploy-last-good
  log "Deployed $(git rev-parse --short HEAD)"
}

main "$@"
