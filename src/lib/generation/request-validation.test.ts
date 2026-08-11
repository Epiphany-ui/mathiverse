import assert from "node:assert/strict";
import test from "node:test";
import { validateCreateJobInput, validatePatchAction } from "./request-validation";

test("generation inputs enforce prompt, code, quality, and format bounds", () => {
  assert.ok("errors" in validateCreateJobInput({ operation: "generate", mode: "new", prompt: "" }));
  assert.ok("errors" in validateCreateJobInput({ operation: "render", mode: "edit", prompt: "", currentCode: null }));
  assert.ok("errors" in validateCreateJobInput({ operation: "generate", mode: "new", prompt: "ok", quality: "-qx" }));
  assert.ok("errors" in validateCreateJobInput({ operation: "generate", mode: "new", prompt: "ok", format: "webm" }));
});

test("publish requires its owned version id, not a redundant code field", () => {
  const result = validatePatchAction({ type: "publish", versionId: "version-1" });
  assert.deepEqual(result, { action: { type: "publish", versionId: "version-1" } });
});
