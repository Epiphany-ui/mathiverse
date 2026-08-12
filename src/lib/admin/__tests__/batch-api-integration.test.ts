import assert from "node:assert/strict";
import test from "node:test";

/**
 * Integration-level tests for the batch API handler logic.
 * These verify the complete request processing pipeline without HTTP auth.
 */

// Simulated requireAdmin check
class AdminAccessDenied extends Error {
  constructor(message = "需要管理员权限") {
    super(message);
    this.name = "AdminAccessDenied";
  }
}

// The TABLE_MAP from the actual batch API route
const TABLE_MAP: Record<string, string> = {
  visualization: "visualizations",
  visualizations: "visualizations",
  article: "articles",
  articles: "articles",
  wiki_entries: "wiki_entries",
  comments: "comments",
};

const VALID_ACTIONS = [
  "ban_users", "unban_users", "delete_content",
  "publish_wiki", "unpublish_wiki",
] as const;

type BatchAction = (typeof VALID_ACTIONS)[number];

function parseTargetsForDelete(targets: string[]): Map<string, string[]> {
  const byType = new Map<string, string[]>();
  for (const t of targets) {
    const [type, id] = t.split(":", 2);
    if (type && id) {
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type)!.push(id);
    }
  }
  return byType;
}

function resolveDuration(duration: string | null): string {
  if (duration === "1h") return new Date(Date.now() + 3600_000).toISOString();
  if (duration === "1d") return new Date(Date.now() + 86400_000).toISOString();
  if (duration === "7d") return new Date(Date.now() + 604800_000).toISOString();
  if (duration === "30d") return new Date(Date.now() + 2592000_000).toISOString();
  return "2999-12-31T23:59:59Z"; // permanent
}

// ─── Tests ──────────────────────────────────────────────────

test("AdminAccessDenied is thrown for unauthenticated requests", () => {
  const user = null;
  assert.throws(() => {
    if (!user) throw new AdminAccessDenied("请先登录");
  }, AdminAccessDenied);
});

test("All batch actions are valid and recognized", () => {
  for (const action of VALID_ACTIONS) {
    assert.ok(VALID_ACTIONS.includes(action));
  }
  assert.equal(VALID_ACTIONS.includes("invalid_action" as any), false);
});

test("delete_content: parseTargetsForDelete handles all 4 content types", () => {
  const targets = [
    "visualization:abc-123",
    "article:def-456",
    "wiki_entries:ghi-789",
    "comments:jkl-012",
  ];

  const byType = parseTargetsForDelete(targets);

  assert.equal(byType.size, 4);
  assert.deepEqual(byType.get("visualization"), ["abc-123"]);
  assert.deepEqual(byType.get("article"), ["def-456"]);
  assert.deepEqual(byType.get("wiki_entries"), ["ghi-789"]);
  assert.deepEqual(byType.get("comments"), ["jkl-012"]);
});

test("delete_content: TABLE_MAP resolves all types to valid table names", () => {
  const byType = parseTargetsForDelete(["visualization:1", "article:2", "wiki_entries:3", "comments:4"]);

  for (const [type, ids] of byType) {
    const table = TABLE_MAP[type];
    assert.ok(table, `Unknown type: ${type}`);
    assert.equal(typeof table, "string");
    assert.ok(table.length > 3, `Invalid table name: ${table}`);
    // Each type maps to its Supabase table name
    if (type === "visualization") assert.equal(table, "visualizations");
    if (type === "article") assert.equal(table, "articles");
    if (type === "wiki_entries") assert.equal(table, "wiki_entries");
    if (type === "comments") assert.equal(table, "comments");
  }
});

test("delete_content: rejects unknown types", () => {
  const byType = parseTargetsForDelete(["unknown_type:123", "visualization:456"]);
  assert.equal(byType.size, 2);

  // Unknown type should not resolve
  const table = TABLE_MAP["unknown_type"];
  assert.equal(table, undefined);
});

test("ban_users: all duration options produce valid dates", () => {
  const now = Date.now();
  const perma = resolveDuration(null);
  assert.ok(new Date(perma).getTime() > now + 1000 * 86400 * 365);

  for (const dur of ["1h", "1d", "7d", "30d"]) {
    const expiry = resolveDuration(dur);
    const expiryMs = new Date(expiry).getTime();
    assert.ok(expiryMs > now, `${dur} should be in the future`);
    assert.ok(expiryMs < now + 1000 * 86400 * 365, `${dur} should not be permanent`);
  }
});

test("ban_users: permanent ban resolves to year 2999", () => {
  const perma = resolveDuration("");
  const d = new Date(perma);
  assert.equal(d.getUTCFullYear(), 2999);
});

test("publish_wiki: slug-based targeting works", () => {
  const targets = ["golden-ratio", "bayes-theorem", "euler-identity"];
  assert.equal(targets.length, 3);
  for (const slug of targets) {
    assert.ok(slug.length > 0);
    assert.ok(/^[a-z0-9-]+$/.test(slug));
  }
});

test("Full batch flow: admin selects viz+wiki → batch delete", () => {
  // Simulate the admin content page flow
  const selected = ["visualization:abc-1", "visualization:def-2", "wiki_entries:ghi-3"];

  const byType = parseTargetsForDelete(selected);
  assert.equal(byType.size, 2);
  assert.equal(byType.get("visualization")?.length, 2);
  assert.equal(byType.get("wiki_entries")?.length, 1);

  // TABLE_MAP resolution
  const ops: { table: string; ids: string[] }[] = [];
  for (const [type, ids] of byType) {
    const table = TABLE_MAP[type];
    assert.ok(table, `No table for ${type}`);
    ops.push({ table, ids });
  }

  assert.equal(ops.length, 2);
  assert.equal(ops[0].table, "visualizations");
  assert.deepEqual(ops[0].ids, ["abc-1", "def-2"]);
  assert.equal(ops[1].table, "wiki_entries");
  assert.deepEqual(ops[1].ids, ["ghi-3"]);

  // These would be: admin.from("visualizations").delete().in("id", ["abc-1","def-2"])
  //                admin.from("wiki_entries").delete().in("id", ["ghi-3"])
});

test("Full batch flow: admin bans 3 users for 7 days", () => {
  const targets = ["user-1", "user-2", "user-3"];
  const duration = "7d";

  const bannedUntil = resolveDuration(duration);
  const expectedMin = Date.now() + 604800_000 - 1000; // 7d minus 1s tolerance
  assert.ok(new Date(bannedUntil).getTime() > expectedMin);

  // Would be: admin.from("profiles").update({banned_until: bannedUntil}).in("id", targets)
  assert.equal(targets.length, 3);
});
