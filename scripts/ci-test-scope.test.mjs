import assert from "node:assert/strict";
import test from "node:test";
import { MCP_RELEASE_BASE, MCP_RELEASE_FILES, selectTestBase, selectTestScope } from "./ci-test-scope.mjs";

const before = { engines: { node: ">=24 <25", pnpm: ">=10 <11" }, scripts: { test: "pnpm -r test" } };
const after = { ...before, engines: { ...before.engines, node: ">=24.10 <25" } };

test("compares complete branch pushes while retaining PR, main and manual release bases", () => {
  assert.equal(selectTestBase("0".repeat(40), "push", "codex/attraction-data-mcp"), "origin/main");
  assert.equal(selectTestBase("f2b2f653755859c689c103d37a8b8bbf6a0571b1", "push", "codex/attraction-data-mcp"), "origin/main");
  assert.equal(selectTestBase(MCP_RELEASE_BASE, "pull_request", "123/merge"), MCP_RELEASE_BASE);
  assert.equal(selectTestBase(MCP_RELEASE_BASE, "push", "main"), MCP_RELEASE_BASE);
  assert.equal(selectTestBase(undefined, "workflow_dispatch", "main"), "HEAD^");
});

test("selects only the complete release packet from its approved base", () => {
  assert.equal(selectTestScope(MCP_RELEASE_FILES, before, after), "mcp");
});

test("retains default checks for future, partial, unrelated and package changes", () => {
  assert.equal(selectTestScope([], before, after), "full");
  assert.equal(selectTestScope(["apps/api/src/index.ts"], before, after), "full");
  assert.equal(selectTestScope([".github/workflows/ci.yml", "scripts/deploy-production.sh"], before, after), "full");
  assert.equal(selectTestScope(MCP_RELEASE_FILES, before, after, ["apps/api/src/agent/attraction-data.ts"]), "full");
  assert.equal(selectTestScope([...MCP_RELEASE_FILES, "apps/api/src/server/auth.ts"], before, after), "full");
  assert.equal(selectTestScope(MCP_RELEASE_FILES, before, { ...after, scripts: { test: "changed" } }), "full");
  assert.equal(selectTestScope(MCP_RELEASE_FILES, after, after), "full");
  assert.equal(selectTestScope(MCP_RELEASE_FILES, before, after, [], "b".repeat(40)), "full");
  assert.equal(MCP_RELEASE_BASE.length, 40);
});
