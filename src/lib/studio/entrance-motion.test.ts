import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error TS5097: Node's TypeScript test runner requires explicit extensions.
import { resolveStudioEntrance } from "./entrance-motion.ts";

test("uses the short settle when resuming a job", () => {
  assert.equal(
    resolveStudioEntrance({ hasPresentationMarker: false, jobId: "job-42" }),
    "resume",
  );
});

test("uses the immersive entrance only once per session", () => {
  assert.equal(
    resolveStudioEntrance({ hasPresentationMarker: false, jobId: null }),
    "first",
  );
  assert.equal(
    resolveStudioEntrance({ hasPresentationMarker: true, jobId: null }),
    "settled",
  );
});

test("treats a blank job value as a plain visit", () => {
  assert.equal(
    resolveStudioEntrance({ hasPresentationMarker: false, jobId: "   " }),
    "first",
  );
});
