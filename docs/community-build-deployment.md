# Community Build deployment

The Community Build path is a parallel release contour. It must not stop,
replace, or reconfigure the existing deployment at
`https://dashboardpriv.claricont.com` until the new runtime passes its full
business smoke and the owner explicitly approves cutover.

## Repository responsibilities

This repository owns application source, tests, the `Dockerfile`, and image
builds. It does not own host Caddy configuration, host package installation,
production secrets, or shared-server administration.

`.github/workflows/build-community-image.yml` builds the application with the
Git revision embedded in `/app/.build-revision`. Pull requests perform a
credential-free local image build. Only `main` and explicitly started manual
runs may receive registry credentials and publish an image.

Required repository variables:

- `COMMUNITY_REGISTRY_HOST`: registry login hostname;
- `COMMUNITY_REGISTRY_IMAGE`: full image repository without tag.

Required repository secrets:

- `COMMUNITY_REGISTRY_USERNAME`;
- `COMMUNITY_REGISTRY_PASSWORD`.

The release identity is the registry digest, not a mutable tag. Production
manifests must reference the image as `<image>@sha256:<digest>`.

## Runtime contract

- Public hostname: `attraction.community-build.ru`.
- Host binding: `127.0.0.1:8102` to container port `8787`.
- Persistent data: an isolated host directory mounted at `/app/data`.
- Secrets: `/etc/platform/secrets/attraction-dashboard.env` on the host.
- Public ingress: host-level Caddy only.
- Container user: non-root UID `10001`.

Shared manifests, deploy authorization, health gates, and rollback live in
`Community-Build/platform-infra`.

## Release evidence

Before any legacy shutdown, record all of the following:

1. repository CI and image build are green;
2. the new host is running the expected immutable digest and source revision;
3. `/api/health` returns `200` through the new HTTPS hostname;
4. unauthenticated `/api/dashboard` returns `401`;
5. the application port is not reachable on the public server IP;
6. the container runs as UID `10001`;
7. the three SQLite databases were copied from a consistent snapshot;
8. Bitrix data and one owner-approved business scenario match the legacy app;
9. rollback to the previous digest has been exercised.
