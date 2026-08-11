import assert from "node:assert/strict";
import test from "node:test";
import { parseEventCursor, serializeSseEvent } from "./sse";

test("serializes one complete resumable SSE record", () => {
  const text = serializeSseEvent({
    id: 7,
    jobId: "job-1",
    createdAt: "2026-08-12T00:00:00.000Z",
    type: "phase.changed",
    data: { phase: "planning", label: "规划场景" },
  });
  assert.match(text, /^id: 7\nevent: phase\.changed\ndata: /);
  assert.ok(text.endsWith("\n\n"));
});

test("Last-Event-ID wins over after and replay cursors remain numeric", () => {
  const request = new Request("http://localhost/events?after=3", {
    headers: { "Last-Event-ID": "8" },
  });
  assert.equal(parseEventCursor(request), 8);
});
