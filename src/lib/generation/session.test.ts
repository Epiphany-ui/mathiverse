import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  createSignedAnonymousSession,
  hashAnonymousSession,
  verifySignedAnonymousSession,
} from "./session";

const SECRET = "test-secret-at-least-32-bytes-long!!";

describe("signed anonymous sessions", () => {
  it("round-trips a valid token", () => {
    const token = createSignedAnonymousSession(SECRET, "session-a");
    const result = verifySignedAnonymousSession(SECRET, token);
    assert.equal(result, "session-a");
  });

  it("rejects tampered payload", () => {
    const token = createSignedAnonymousSession(SECRET, "session-a");
    const tampered = token.replace("session-a", "session-b");
    assert.equal(verifySignedAnonymousSession(SECRET, tampered), null);
  });

  it("rejects a bare UUID (no signature)", () => {
    assert.equal(verifySignedAnonymousSession(SECRET, "just-a-uuid"), null);
  });

  it("rejects when the secret differs", () => {
    const token = createSignedAnonymousSession(SECRET, "session-a");
    assert.equal(
      verifySignedAnonymousSession("wrong-secret-xxxxxxxxxxxxxxxxx", token),
      null,
    );
  });

  it("rejects an equal-length non-hex signature without throwing", () => {
    const token = createSignedAnonymousSession(SECRET, "session-a");
    const malformed = `${token.slice(0, token.lastIndexOf(".") + 1)}${"z".repeat(64)}`;
    assert.doesNotThrow(() => verifySignedAnonymousSession(SECRET, malformed));
    assert.equal(verifySignedAnonymousSession(SECRET, malformed), null);
  });

  it("produces deterministic hashes", () => {
    const a = hashAnonymousSession("session-a");
    const b = hashAnonymousSession("session-a");
    assert.equal(a, b);
  });

  it("uses ordinary SHA-256 for stored session hashes", () => {
    assert.equal(
      hashAnonymousSession("session-a"),
      createHash("sha256").update("session-a").digest("hex"),
    );
  });

  it("hashes different sessions differently", () => {
    const a = hashAnonymousSession("session-a");
    const b = hashAnonymousSession("session-b");
    assert.notEqual(a, b);
  });
});
