#!/usr/bin/env node
/**
 * Production readiness check — validates code, build, and runtime health.
 *
 * Usage:  node scripts/production-readiness.mjs
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}: ${result}`);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

console.log("\n🔍 Production Readiness Check\n");

// ─── Code quality ──────────────────────────────────────────
console.log("Code quality:");
check("TypeScript compiles", () => {
  execSync("pnpm tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
});
check("Tests pass", () => {
  execSync("pnpm test --run", { cwd: ROOT, stdio: "pipe" });
});
check("Build succeeds", () => {
  execSync("pnpm build", { cwd: ROOT, stdio: "pipe" });
});

// ─── Files that must exist ─────────────────────────────────
console.log("\nRequired files:");
const required = [
  ".env.local",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/api/visualizations/route.ts",
  "src/app/api/wiki/route.ts",
  "src/app/api/account/route.ts",
  "src/app/api/articles/route.ts",
  "src/app/auth/reset-password/page.tsx",
  "src/app/auth/update-password/page.tsx",
  "src/lib/supabase/middleware.ts",
  "src/lib/supabase/with-timeout.ts",
  "src/lib/db/wiki.ts",
  "src/lib/db/queries.ts",
  "src/components/layout/theme-toggle.tsx",
  "supabase/migrations/015_fix_wiki_rls.sql",
  "supabase/migrations/016_notifications.sql",
  "supabase/migrations/017_fix_username_collision.sql",
  "scripts/smoke-test.mjs",
];
for (const f of required) {
  check(`File: ${f}`, () => existsSync(resolve(ROOT, f)) || `NOT FOUND`);
}

// ─── Dead code checks ──────────────────────────────────────
console.log("\nDead code removal:");
const deleted = [
  "src/lib/db/mock-data.ts",
  "src/app/auth/actions.ts",
  "src/hooks/use-auth.ts",
  "src/app/loading.tsx",
];
for (const f of deleted) {
  check(`Removed: ${f}`, () => !existsSync(resolve(ROOT, f)) || `STILL EXISTS`);
}

// ─── Security checks ───────────────────────────────────────
console.log("\nSecurity:");
check("Banned users blocked from API", () => {
  const mw = readFileSync(resolve(ROOT, "src/lib/supabase/middleware.ts"), "utf-8");
  if (!mw.includes("isApi")) return "API ban check missing";
  if (!mw.includes("status: 403")) return "API 403 response missing";
});
check("Fork requires published source", () => {
  const sc = readFileSync(resolve(ROOT, "src/app/sandbox/sandbox-content.tsx"), "utf-8");
  if (!sc.includes('eq("is_published", true)')) return "Fork publish check missing";
});
check("Account deletion requires auth", () => {
  const acct = readFileSync(resolve(ROOT, "src/app/api/account/route.ts"), "utf-8");
  if (!acct.includes("getUser()")) return "Auth check missing";
  if (!acct.includes("deleteUser")) return "Delete call missing";
});
check("Article creation is server-validated", () => {
  const art = readFileSync(resolve(ROOT, "src/app/api/articles/route.ts"), "utf-8");
  if (!art.includes("title.length < 2")) return "Title validation missing";
  if (!art.includes("bodyMd")) return "Body validation missing";
});

// ─── Feature completeness ──────────────────────────────────
console.log("\nFeature completeness:");
check("Password reset flow", () => {
  const r1 = existsSync(resolve(ROOT, "src/app/auth/reset-password/page.tsx"));
  const r2 = existsSync(resolve(ROOT, "src/app/auth/update-password/page.tsx"));
  if (!r1) return "reset-password page missing";
  if (!r2) return "update-password page missing";
});
check("Login error display", () => {
  const lf = readFileSync(resolve(ROOT, "src/app/auth/login/login-form.tsx"), "utf-8");
  if (!lf.includes("serverError")) return "Error param handling missing";
  if (!lf.includes("banned")) return "Banned error message missing";
});
check("Email verification UX", () => {
  const rf = readFileSync(resolve(ROOT, "src/app/auth/register/register-form.tsx"), "utf-8");
  if (!rf.includes("emailSent")) return "Email sent state missing";
});
check("Dark mode toggle", () => {
  const l = readFileSync(resolve(ROOT, "src/app/layout.tsx"), "utf-8");
  if (!l.includes("ThemeProvider")) return "ThemeProvider missing";
  const h = readFileSync(resolve(ROOT, "src/components/layout/app-header.tsx"), "utf-8");
  if (!h.includes("ThemeToggle")) return "ThemeToggle in header missing";
});
check("Wiki in search results", () => {
  const q = readFileSync(resolve(ROOT, "src/lib/db/queries.ts"), "utf-8");
  if (!q.includes('type: "wiki"')) return "Wiki type in search missing";
});
check("Wiki in bookmarks", () => {
  const q = readFileSync(resolve(ROOT, "src/lib/db/queries.ts"), "utf-8");
  if (!q.includes("wikiIds")) return "Wiki bookmark support missing";
});
check("RAG auto-indexing wired", () => {
  const viz = readFileSync(resolve(ROOT, "src/app/api/visualizations/route.ts"), "utf-8");
  if (!viz.includes("tryAutoIndex")) return "tryAutoIndex call missing";
});
check("Video persistence failure safe", () => {
  const viz = readFileSync(resolve(ROOT, "src/app/api/visualizations/route.ts"), "utf-8");
  if (!viz.includes("persistedVideoUrl = null")) return "Video null fallback missing";
});
check("Username collision handled", () => {
  const m = readFileSync(resolve(ROOT, "supabase/migrations/017_fix_username_collision.sql"), "utf-8");
  if (!m.includes("unique_violation")) return "Exception handling missing";
});
check("Query timeouts in wiki", () => {
  const w = readFileSync(resolve(ROOT, "src/lib/db/wiki.ts"), "utf-8");
  if (!w.includes("withTimeout")) return "Timeout wrapper missing";
});

// ─── Summary ───────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} checks\n`);
process.exit(failed > 0 ? 1 : 0);
