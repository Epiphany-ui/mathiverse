import assert from "node:assert/strict";
import test from "node:test";
import { validateCreateJobInput, validatePatchAction } from "./request-validation";

test("generation inputs enforce prompt, code, quality, and format bounds", () => {
  assert.ok("errors" in validateCreateJobInput({ operation: "generate", mode: "new", prompt: "" }));
  assert.ok("errors" in validateCreateJobInput({ operation: "render", mode: "edit", prompt: "", currentCode: null }));
  assert.ok("errors" in validateCreateJobInput({ operation: "generate", mode: "new", prompt: "ok", quality: "-qx" }));
  assert.ok("errors" in validateCreateJobInput({ operation: "generate", mode: "new", prompt: "ok", format: "webm" }));
});

test("rollback requires its owned version id", () => {
  const result = validatePatchAction({ type: "rollback", versionId: "version-1" });
  assert.deepEqual(result, { action: { type: "rollback", versionId: "version-1" } });
});
