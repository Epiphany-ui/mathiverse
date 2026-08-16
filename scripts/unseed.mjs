// Unseed script — removes the demo/mock content created by seed.mjs.
//
// Usage:
//   node scripts/unseed.mjs               # remove demo content + demo users
//   node scripts/unseed.mjs --keep-users  # remove demo content, keep the
//                                         #   demo accounts for real use
//   node scripts/unseed.mjs --orphans     # also sweep interactions pointing
//                                         #   at targets that no longer exist
//
// Idempotent: fixed UUIDs + @mathiverse.dev accounts only.  Real content
// created by real users is never touched (except interactions attached to
// the demo rows themselves, which stop making sense once their target is
// deleted).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const env = {};
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("❌ 需要 .env.local 中的 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshJwt: false } });

// Fixed UUIDs from seed.mjs
const VIZ_IDS = [
  "00000000-0000-4000-8001-000000000001",
  "00000000-0000-4000-8001-000000000002",
  "00000000-0000-4000-8001-000000000003",
  "00000000-0000-4000-8001-000000000004",
  "00000000-0000-4000-8001-000000000005",
  "00000000-0000-4000-8001-000000000006",
];
const ARTICLE_IDS = [
  "00000000-0000-4000-8002-000000000001",
  "00000000-0000-4000-8002-000000000002",
];
const COMMENT_IDS = [
  "00000000-0000-4000-8003-000000000001",
  "00000000-0000-4000-8003-000000000002",
  "00000000-0000-4000-8003-000000000003",
  "00000000-0000-4000-8003-000000000004",
  "00000000-0000-4000-8003-000000000005",
  "00000000-0000-4000-8003-000000000006",
  "00000000-0000-4000-8003-000000000007",
];

const contentIds = [...VIZ_IDS, ...ARTICLE_IDS, ...COMMENT_IDS];

async function deleteWhere(table, column, ids) {
  if (ids.length === 0) return 0;
  // likes/bookmarks/follows use composite keys and have no id column —
  // count rows via PostgREST's count instead of selecting columns back.
  const { count, error } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .in(column, ids);
  if (error) {
    console.warn(`  ⚠ ${table}.${column}: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

async function main() {
  const sweepOrphans = process.argv.includes("--orphans");
  const keepUsers = process.argv.includes("--keep-users");
  console.log("🧹 Unseeding Mathiverse demo content...\n");

  // ── 1. Find demo users ──────────────────────────────────────
  const { data: usersPage, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (userErr) {
    console.error(`❌ 无法列出用户: ${userErr.message}`);
    process.exit(1);
  }
  const seedUsers = (usersPage?.users ?? []).filter((u) => u.email?.endsWith("@mathiverse.dev"));
  const seedUserIds = seedUsers.map((u) => u.id);
  console.log(`Step 1: 找到 ${seedUserIds.length} 个演示用户`);

  // ── 2. Interactions owned by demo users (follows, likes, bookmarks,
  //       notifications) — content-targeted rows are removed in step 3/4.
  const removedFollows = await deleteWhere("follows", "follower_id", seedUserIds);
  await deleteWhere("follows", "following_id", seedUserIds);
  console.log(`Step 2: 删除演示用户关注关系 ${removedFollows} 条`);

  await deleteWhere("likes", "user_id", seedUserIds);
  await deleteWhere("bookmarks", "user_id", seedUserIds);
  await deleteWhere("notifications", "user_id", seedUserIds);
  await deleteWhere("notifications", "actor_id", seedUserIds);

  // ── 3. Demo content: comments → articles → visualizations.
  //       The migration 019 cleanup triggers cascade the rest; explicit
  //       deletes here keep it safe even on databases without 019 applied.
  console.log("Step 3: 删除演示评论...");
  await deleteWhere("comments", "id", COMMENT_IDS);
  await deleteWhere("likes", "target_id", contentIds);
  await deleteWhere("bookmarks", "target_id", contentIds);
  await deleteWhere("notifications", "target_id", contentIds);

  console.log("Step 4: 删除演示文章与可视化...");
  await deleteWhere("articles", "id", ARTICLE_IDS);
  await deleteWhere("visualizations", "id", VIZ_IDS);
  // Trigger-cascade may not exist pre-019 — clean the polymorphic leftovers.
  for (const type of ["visualization", "article"]) {
    const ids = type === "visualization" ? VIZ_IDS : ARTICLE_IDS;
    await deleteWhere("likes", "target_id", ids);
    await deleteWhere("bookmarks", "target_id", ids);
    await deleteWhere("comments", "target_id", ids);
    await deleteWhere("notifications", "target_id", ids);
  }

  // ── 5. Delete demo auth users (cascades profiles via FK) ─────
  if (keepUsers) {
    console.log("Step 5: --keep-users — 保留演示账号，仅清理其演示互动。");
  } else {
    console.log("Step 5: 删除演示用户账号...");
    for (const user of seedUsers) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) console.warn(`  ⚠ ${user.email}: ${error.message}`);
      else console.log(`  ✅ ${user.email}`);
    }
  }

  // ── 6. Optional orphan sweep ─────────────────────────────────
  if (sweepOrphans) {
    console.log("\nStep 6: 清理指向不存在目标的孤儿互动...");
    const tables = [
      { targetType: "visualization", table: "visualizations" },
      { targetType: "article", table: "articles" },
      { targetType: "wiki", table: "wiki_entries" },
    ];
    for (const { targetType, table } of tables) {
      const { data: existing } = await supabase.from(table).select("id");
      const idSet = new Set((existing ?? []).map((r) => r.id));
      for (const orphanTable of ["likes", "bookmarks", "comments", "notifications"]) {
        const isPair = orphanTable === "likes" || orphanTable === "bookmarks";
        const selectCols = isPair ? "user_id, target_id" : "id, target_id";
        const { data: rows } = await supabase
          .from(orphanTable)
          .select(selectCols)
          .eq("target_type", targetType);
        const orphanTargets = [
          ...new Set(
            (rows ?? [])
              .filter((r) => r.target_id && !idSet.has(r.target_id))
              .map((r) => r.target_id),
          ),
        ];
        if (orphanTargets.length > 0) {
          const removed = await deleteWhere(orphanTable, "target_id", orphanTargets);
          console.log(`  🧹 ${orphanTable}/${targetType}: ${removed} 条孤儿已清理`);
        }
      }
    }
  } else {
    console.log("\n（跳过孤儿互动清理——需要时加 --orphans 参数）");
  }

  console.log("\n✅ 演示数据清理完成。");
  if (seedUserIds.length === 0 && !sweepOrphans) {
    console.log("   没有找到任何 @mathiverse.dev 演示用户，数据库本来就是干净的。");
  }
}

main().catch((err) => {
  console.error("💥 Unseed failed:", err.message);
  process.exit(1);
});
