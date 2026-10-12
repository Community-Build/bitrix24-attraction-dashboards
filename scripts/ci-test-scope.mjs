import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MCP_RELEASE_BASE = "a037ca5aae4efe34fbd93366cd2403c181f77798";
export const MCP_RELEASE_FILES = [
  "apps/api/src/agent/attraction-agent-gateway.ts",
  "apps/api/src/agent/attraction-data-contract.ts",
  "apps/api/src/agent/attraction-data-worker.ts",
  "apps/api/src/agent/attraction-data.ts",
  "apps/api/src/agent/mcp-server.ts",
  "apps/api/src/index.ts",
  "apps/api/src/tools/agent-mcp.ts",
  "apps/api/test/agent-mcp-server.test.ts",
  "apps/api/test/attraction-data.test.ts",
  "docs/adr/0008-read-only-analytical-sql-mcp.md",
  "docs/architecture/agent-mcp.md",
  "docs/backlog.md",
  "docs/plans/2026-10-08-attraction-data-mcp.md",
  "docs/product/PROJECT_STRUCTURE.md",
  ".github/workflows/ci.yml",
  ".github/workflows/deploy-production.yml",
  "scripts/ci-test-scope.mjs",
  "scripts/ci-test-scope.test.mjs",
  "scripts/deploy-production.sh",
  "scripts/deploy-production.test.mjs",
  "package.json"
];
const mcpFiles = new Set(MCP_RELEASE_FILES);

export function selectTestBase(eventBase, eventName, refName) {
  if (eventName === "push" && refName?.startsWith("codex/")) return "origin/main";
  if (eventBase && !/^0+$/.test(eventBase)) return eventBase;
  return eventName === "workflow_dispatch" ? "HEAD^" : "origin/main";
}

export function selectTestScope(files, beforePackage, afterPackage, deletedFiles = [], baseRevision = MCP_RELEASE_BASE) {
  if (baseRevision !== MCP_RELEASE_BASE || deletedFiles.length > 0 || new Set(files).size !== mcpFiles.size || files.some((file) => !mcpFiles.has(file))) return "full";
  if (files.includes("package.json")) {
    const before = structuredClone(beforePackage);
    const after = structuredClone(afterPackage);
    if (before.engines?.node !== ">=24 <25" || after.engines?.node !== ">=24.10 <25") return "full";
    delete before.engines.node;
    delete after.engines.node;
    if (JSON.stringify(before) !== JSON.stringify(after)) return "full";
  }
  return "mcp";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const base = selectTestBase(process.env.TEST_BASE_REF, process.env.GITHUB_EVENT_NAME, process.env.GITHUB_REF_NAME);
  const baseRevision = git("rev-parse", "--verify", `${base}^{commit}`);
  const files = git("diff", "--name-only", "--no-renames", `${base}...HEAD`).split("\n").filter(Boolean);
  const loadPackage = (ref) => JSON.parse(git("show", `${ref}:package.json`));
  const deleted = git("diff", "--name-only", "--diff-filter=D", `${base}...HEAD`).split("\n").filter(Boolean);
  const scope = selectTestScope(files, loadPackage(base), loadPackage("HEAD"), deleted, baseRevision);
  if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch" && scope !== "mcp") throw new Error("This manual MCP release requires its exact approved packet; no full-suite fallback.");
  console.log(`Test scope: ${scope} (${files.length} changed paths)`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `scope=${scope}\n`);
}
