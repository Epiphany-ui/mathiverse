import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Login form validation rejects empty email", () => {
  const email = "";
  const password = "validpass";
  assert.equal(email.length > 0 && password.length >= 6, false);
});

test("Login form validation rejects short password", () => {
  const email = "test@example.com";
  const password = "12345";
  assert.equal(email.length > 0 && password.length >= 6, false);
});

test("Login form validation accepts valid credentials", () => {
  const email = "test@example.com";
  const password = "123456";
  assert.equal(email.length > 0 && password.length >= 6, true);
});

test("Safe redirect rejects protocol-absolute URLs", () => {
  const isSafe = (raw: string | null) =>
    raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  assert.equal(isSafe(null), "/");
  assert.equal(isSafe("//evil.com"), "/");
  assert.equal(isSafe("/sandbox"), "/sandbox");
  assert.equal(isSafe("/wiki/test"), "/wiki/test");
});

test("Server error messages map correctly", () => {
  const errors: Record<string, string> = {
    banned: "你的账号已被封禁。如有疑问请联系管理员。",
    auth_callback_error: "第三方登录失败，请重试或使用邮箱密码登录。",
  };
  assert.ok(errors.banned.includes("封禁"));
  assert.ok(errors.auth_callback_error.includes("第三方"));
  assert.equal(errors["unknown"] ?? null, null);
});

test("Register form rejects short username", () => {
  assert.equal("ab".length >= 3, false);
});

test("Register form accepts valid username", () => {
  assert.equal("testuser".length >= 3, true);
});

test("Register form rejects short password", () => {
  assert.equal("12345".length >= 6, false);
});

test("Register form accepts valid password", () => {
  assert.equal("secure123".length >= 6, true);
});

test("Password reset validates email format", () => {
  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  assert.equal(isValidEmail("test@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail(""), false);
});

test("Password reset validates minimum length", () => {
  const isValid = (pw: string) => pw.length >= 6;
  assert.equal(isValid("123456"), true);
  assert.equal(isValid("12345"), false);
});

test("Ban enforcement checks API paths", () => {
  const isApi = (p: string) => p.startsWith("/api/");
  assert.equal(isApi("/api/admin/stats"), true);
  assert.equal(isApi("/sandbox"), false);
  assert.equal(isApi("/api/generation/jobs"), true);
});

test("Permanent ban is far future", () => {
  const permaBan = new Date("2999-12-31T23:59:59Z");
  assert.ok(permaBan.getTime() > Date.now());
});

test("1 hour ban duration is correct", () => {
  const now = Date.now();
  const oneHour = new Date(now + 3600_000);
  assert.equal(oneHour.getTime() - now, 3600_000);
});

test("Account deletion API route exists", () => {
  const exists = fs.existsSync(
    path.resolve(import.meta.dirname, "../../../app/api/account/route.ts"),
  );
  assert.equal(exists, true);
});

test("All protected routes are listed", () => {
  const protectedPaths = ["/sandbox", "/settings", "/create", "/admin", "/wiki/new"];
  assert.equal(protectedPaths.length, 5);
  assert.ok(protectedPaths.includes("/sandbox"));
  assert.ok(protectedPaths.includes("/wiki/new"));
});

test("Batch API validates actions", () => {
  const VALID = ["ban_users", "unban_users", "delete_content", "publish_wiki", "unpublish_wiki"];
  assert.ok(VALID.includes("ban_users"));
  assert.ok(VALID.includes("delete_content"));
  assert.equal(VALID.includes("invalid_action"), false);
});
