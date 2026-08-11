import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const rootMigration = readFileSync(
  new URL("../../../supabase-migration.sql", import.meta.url),
  "utf8",
);
const hardeningMigrationUrl = new URL(
  "../../../supabase/migrations/006_restrict_bookmark_reads.sql",
  import.meta.url,
);

test("bookmark reads are restricted to the authenticated owner", () => {
  assert.doesNotMatch(
    rootMigration,
    /CREATE POLICY "bookmarks_read_all"[\s\S]*?USING \(true\)/,
  );
  assert.match(
    rootMigration,
    /CREATE POLICY "bookmarks_read_own"[\s\S]*?USING \(auth\.uid\(\) = user_id\)/,
  );

});

test("existing databases receive a bookmark policy hardening migration", () => {
  assert.equal(existsSync(hardeningMigrationUrl), true);
  const hardeningMigration = readFileSync(hardeningMigrationUrl, "utf8");
  assert.match(hardeningMigration, /DROP POLICY IF EXISTS "bookmarks_read_all"/);
  assert.match(
    hardeningMigration,
    /CREATE POLICY "bookmarks_read_own"[\s\S]*?USING \(auth\.uid\(\) = user_id\)/,
  );
});
