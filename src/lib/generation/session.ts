import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export const SANDBOX_SESSION_COOKIE = "mathiverse_sandbox_session";

/**
 * Create a signed anonymous session token: "<uuid>.<hex-hmac>".
 * The UUID is the session ID; the HMAC prevents tampering.
 */
export function createSignedAnonymousSession(
  secret: string,
  sessionId: string = randomUUID(),
): string {
  const hmac = createHmac("sha256", secret).update(sessionId).digest("hex");
  return `${sessionId}.${hmac}`;
}

/**
 * Verify and extract the session ID from a signed token.
 * Returns null if the token is malformed or the signature doesn't match.
 */
export function verifySignedAnonymousSession(
  secret: string,
  token: string,
): string | null {
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;

  const sessionId = token.slice(0, idx);
  const receivedSig = token.slice(idx + 1);
  const expectedSig = createHmac("sha256", secret)
    .update(sessionId)
    .digest("hex");

  if (
    receivedSig.length !== expectedSig.length ||
    !/^[0-9a-f]+$/i.test(receivedSig)
  ) {
    return null;
  }

  const received = Buffer.from(receivedSig, "hex");
  const expected = Buffer.from(expectedSig, "hex");

  if (received.length !== expected.length) return null;
  if (!timingSafeEqual(received, expected)) return null;

  return sessionId;
}

/**
 * Hash a session ID for database storage.
 */
export function hashAnonymousSession(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}
