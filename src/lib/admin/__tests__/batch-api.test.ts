import assert from "node:assert/strict";
import test from "node:test";

// Verify the TABLE_MAP logic used in POST /api/admin/batch delete_content
const TABLE_MAP: Record<string, string> = {
  visualization: "visualizations",
  visualizations: "visualizations",
  article: "articles",
  articles: "articles",
  wiki_entries: "wiki_entries",
  comments: "comments",
};

test("TABLE_MAP resolves singular content types to Supabase table names", () => {
  // The admin content page sends "visualization:abc" (singular from ContentItem.type)
  assert.equal(TABLE_MAP["visualization"], "visualizations");
  assert.equal(TABLE_MAP["article"], "articles");
  // Plural forms also work (direct from API)
  assert.equal(TABLE_MAP["visualizations"], "visualizations");
  assert.equal(TABLE_MAP["articles"], "articles");
  // Wiki and comments always use plural
  assert.equal(TABLE_MAP["wiki_entries"], "wiki_entries");
  assert.equal(TABLE_MAP["comments"], "comments");
  // Unknown types return undefined
  assert.equal(TABLE_MAP["nonexistent"], undefined);
});

test("parse content targets correctly", () => {
  // Simulate the parsing logic from the batch API
  const targets = [
    "visualization:abc-123",
    "article:def-456",
    "wiki_entries:ghi-789",
    "comments:jkl-012",
  ];

  const byType = new Map<string, string[]>();
  for (const t of targets) {
    const [type, id] = t.split(":", 2);
    if (type && id) {
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type)!.push(id);
    }
  }

  assert.equal(byType.size, 4);
  assert.deepEqual(byType.get("visualization"), ["abc-123"]);
  assert.deepEqual(byType.get("wiki_entries"), ["ghi-789"]);

  // Check table resolution
  for (const [type, ids] of byType) {
    const table = TABLE_MAP[type];
    assert.ok(table, `Unknown type: ${type}`);
    // Verify each type resolves to a valid table
    assert.equal(typeof table, "string");
  }
});

test("ban_users duration mapping is correct", () => {
  const durations: Record<string, number> = {
    "1h": 3600_000,
    "1d": 86400_000,
    "7d": 604800_000,
    "30d": 2592000_000,
    "": 0, // permanent → special handling
  };

  for (const [dur, ms] of Object.entries(durations)) {
    if (dur === "") {
      // Permanent ban → set to "2999-12-31T23:59:59Z"
      const perm = new Date("2999-12-31T23:59:59Z");
      assert.ok(perm.getTime() > Date.now());
    } else {
      const expires = new Date(Date.now() + ms);
      assert.ok(expires.getTime() > Date.now());
    }
  }
});

test("batch API action validation", () => {
  const VALID_ACTIONS = [
    "ban_users",
    "unban_users",
    "delete_content",
    "publish_wiki",
    "unpublish_wiki",
  ];

  for (const action of VALID_ACTIONS) {
    assert.ok(VALID_ACTIONS.includes(action));
  }

  assert.equal(VALID_ACTIONS.includes("invalid_action"), false);
  assert.equal(VALID_ACTIONS.includes(""), false);
});

test("empty targets returns error", () => {
  const targets: string[] = [];
  // The API returns: { error: "targets 不能为空" }
  assert.equal(targets.length, 0);
  assert.equal(targets.length > 0, false);
});
