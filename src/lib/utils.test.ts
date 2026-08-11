import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error TS5097: Node's TypeScript test runner requires explicit extensions.
import { addComment } from "./db/interactions.ts";
import type { getCommentsForTarget } from "./db/queries";
// @ts-expect-error TS5097: Node's TypeScript test runner requires explicit extensions.
import { isLocalRendererUrl } from "./utils.ts";

test("isLocalRendererUrl accepts both local renderer protocols", () => {
  assert.equal(isLocalRendererUrl("http://localhost:9876/render"), true);
  assert.equal(isLocalRendererUrl("https://127.0.0.1:9876/render"), true);
});

test("isLocalRendererUrl rejects non-renderer URLs", () => {
  assert.equal(isLocalRendererUrl("http://localhost:3000/render"), false);
  assert.equal(isLocalRendererUrl("https://example.com:9876/render"), false);
  assert.equal(isLocalRendererUrl(null), false);
});

test("addComment accepts wiki as a comment target", () => {
  const targetType: Parameters<typeof addComment>[1]["targetType"] = "wiki";

  assert.equal(targetType, "wiki");
});

test("getCommentsForTarget accepts wiki as a comment target", () => {
  const targetType: Parameters<typeof getCommentsForTarget>[1] = "wiki";

  assert.equal(targetType, "wiki");
});
