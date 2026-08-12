#!/usr/bin/env node
/**
 * End-to-end smoke test — verifies that all critical pages and APIs
 * return expected HTTP status codes and contain expected content.
 *
 * Usage:  node scripts/smoke-test.mjs [baseUrl]
 * Default: http://localhost:3000
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

async function check(name, url, opts = {}) {
  const { expectStatus, expectContains, expectNotContains, method = "GET" } = opts;
  try {
    const res = await fetch(`${BASE}${url}`, { method, redirect: "manual" });
    const body = await res.text();
    const ok = (expectStatus === undefined || res.status === expectStatus)
      && (!expectContains || body.includes(expectContains))
      && (!expectNotContains || !body.includes(expectNotContains));
    if (ok) {
      console.log(`  ✓ ${name} (${res.status}, ${body.length}B)`);
      passed++;
    } else {
      const reasons = [];
      if (res.status !== expectStatus) reasons.push(`status ${res.status} ≠ ${expectStatus}`);
      if (expectContains && !body.includes(expectContains)) reasons.push(`missing "${expectContains.slice(0, 50)}..."`);
      if (expectNotContains && body.includes(expectNotContains)) reasons.push(`unexpected "${expectNotContains.slice(0, 50)}..."`);
      console.log(`  ✗ ${name}: ${reasons.join("; ")}`);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

console.log(`\n🔍 Smoke testing ${BASE}\n`);

// ─── Public pages ──────────────────────────────────────────
console.log("Public pages:");
await check("Home", "/", { expectContains: "Mathiverse" });
await check("Explore", "/explore", { expectContains: "</html>" });
await check("Search", "/search", { expectContains: "</html>" });
await check("Wiki", "/wiki", { expectContains: "百科" });
await check("Login", "/auth/login", { expectContains: "登录" });
await check("Register", "/auth/register", { expectContains: "注册" });
await check("Reset password", "/auth/reset-password", { expectContains: "重置密码" });

// ─── Protected pages (redirect to login) ──────────────────
console.log("\nProtected pages (unauthenticated → redirect):");
await check("Sandbox", "/sandbox", { expectStatus: 307 });
await check("Settings", "/settings", { expectStatus: 307 });
await check("Create", "/create", { expectStatus: 307 });

// ─── Public APIs ───────────────────────────────────────────
console.log("\nPublic APIs:");
await check("Generation jobs API", "/api/generation/jobs");

// ─── Admin APIs (require auth) ─────────────────────────────
console.log("\nAdmin APIs (unauthenticated → 401):");
await check("Admin stats", "/api/admin/stats", { expectStatus: 401 });
await check("Admin wiki-list", "/api/admin/wiki-list", { expectStatus: 401 });
await check("Admin users", "/api/admin/users", { expectStatus: 401 });

// ─── Content checks ────────────────────────────────────────
console.log("\nContent checks:");
await check("Wiki has entries", "/wiki", { expectContains: "个词条" });
await check("Home has no spinner", "/", { expectNotContains: "加载中..." });
await check("Wiki has no spinner", "/wiki", { expectNotContains: "加载中..." });

// ─── Authenticated endpoints (anonymously, should reject) ──
console.log("\nWrite endpoints (unauthenticated → reject):");
await check("POST /api/articles", "/api/articles", { method: "POST", expectStatus: 401 });
await check("POST /api/wiki", "/api/wiki", { method: "POST", expectStatus: 401 });
await check("DELETE /api/account", "/api/account", { method: "DELETE", expectStatus: 401 });

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} checks\n`);
process.exit(failed > 0 ? 1 : 0);
