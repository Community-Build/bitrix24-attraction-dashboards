import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const source = readFileSync(new URL("./deploy-production.sh", import.meta.url), "utf8").replace(/\nmain "\$@"\s*$/, "\n");
const image = `sha256:${"a".repeat(64)}`;

function run(body) {
  const cwd = mkdtempSync(join(tmpdir(), "attraction-deploy-test-"));
  writeFileSync(join(cwd, ".env.production"), "# fixture\n");
  try {
    return spawnSync("bash", ["-c", `${source}\n${body}`], {
      cwd, encoding: "utf8", env: { ...process.env, DEPLOY_REPO: "fixture", DEPLOY_REF: "new-ref", DEPLOY_APP_DIR: cwd }
    });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
}

const mockDocker = `
docker() {
  printf 'docker'; printf ' %s' "$@"; printf '\\n'
  if [ "$1" = compose ]; then
    local prior="" arg
    for arg in "$@"; do
      if [ "$prior" = -f ] && [ -f "$arg" ]; then cat "$arg"; fi
      prior="$arg"
    done
  fi
}
git() { printf 'git'; printf ' %s' "$@"; printf '\\n'; }
`;

test("rollback starts the retained exact image without rebuilding", () => {
  const r = run(`${mockDocker}\nrestore_previous_release previous-ref ${image}`);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /up -d --no-build --remove-orphans app/);
  assert.ok(r.stdout.includes(`image: "${image}"`));
  assert.doesNotMatch(r.stdout, /docker .* build /);
});

test("invalid image references cannot activate a container", () => {
  const r = run(`${mockDocker}\nstart_compose_image latest`);
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout, /docker/);
});

test("incompatible Node image fails before activation even in a conditional", () => {
  const r = run(`
docker() {
  if [ "$1" = run ]; then return 1; fi
  if [ "$1" = image ]; then printf '${image}'; return; fi
  if [[ "$*" == *"config --images"* ]]; then printf 'fixture-image'; return; fi
  printf 'docker'; printf ' %s' "$@"; printf '\\n'
}
if build_compose_project new-ref; then exit 98; fi
`);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /up -d/);
});
