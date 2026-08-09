import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error TS5097: Node's TypeScript test runner requires explicit extensions.
import type { FeedItem } from "../../types/index.ts";
// @ts-expect-error TS5097: Node's TypeScript test runner requires explicit extensions.
import { selectGalleryFeature } from "./home-data.ts";

function makeItem(
  id: string,
  type: FeedItem["type"],
  overrides: Partial<FeedItem> = {},
): FeedItem {
  return {
    id,
    type,
    title: `Item ${id}`,
    description: "A mathematical study",
    tags: [],
    author: {
      id: "author-1",
      username: "math-author",
      displayName: "Math Author",
      avatarUrl: null,
    },
    likesCount: 0,
    commentsCount: 0,
    createdAt: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

test("selectGalleryFeature prefers the first visualization with video", () => {
  const items = [
    makeItem("viz-without-video", "visualization"),
    makeItem("article", "article"),
    makeItem("viz-with-video", "visualization", {
      videoUrl: "/renders/orbit.mp4",
    }),
  ];

  assert.equal(selectGalleryFeature(items)?.id, "viz-with-video");
});

test("selectGalleryFeature falls back to the first visualization", () => {
  const items = [
    makeItem("article", "article"),
    makeItem("viz", "visualization", { videoUrl: null }),
  ];

  assert.equal(selectGalleryFeature(items)?.id, "viz");
});

test("selectGalleryFeature returns null without visualizations", () => {
  const items = [makeItem("article", "article")];

  assert.equal(selectGalleryFeature(items), null);
});
