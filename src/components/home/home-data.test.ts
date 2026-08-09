import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error TS5097: Node's TypeScript test runner requires explicit extensions.
import type { FeedItem } from "../../types/index.ts";
// @ts-expect-error TS5097: Node's TypeScript test runner requires explicit extensions.
import { buildEditorialSlots, buildFieldLinks, selectGalleryFeature } from "./home-data.ts";

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

test("buildEditorialSlots excludes the hero and never duplicates content", () => {
  const feature = makeItem("hero", "visualization", {
    videoUrl: "/hero.mp4",
  });
  const lead = makeItem("lead", "visualization");
  const story = makeItem("story", "article");
  const supportA = makeItem("support-a", "visualization");
  const supportB = makeItem("support-b", "article");

  const slots = buildEditorialSlots(
    [feature, lead, story, supportA, supportB],
    feature,
  );
  const ids = [
    slots.lead?.id,
    slots.story?.id,
    ...slots.supporting.map((item) => item.id),
  ].filter(Boolean);

  assert.equal(slots.lead?.id, "lead");
  assert.equal(slots.story?.id, "story");
  assert.deepEqual(slots.supporting.map((item) => item.id), [
    "support-a",
    "support-b",
  ]);
  assert.equal(ids.includes("hero"), false);
  assert.equal(new Set(ids).size, ids.length);
});

test("buildEditorialSlots handles sparse content without fabrication", () => {
  const onlyArticle = makeItem("story", "article");

  assert.deepEqual(buildEditorialSlots([onlyArticle], null), {
    lead: onlyArticle,
    story: null,
    supporting: [],
  });
  assert.deepEqual(buildEditorialSlots([], null), {
    lead: null,
    story: null,
    supporting: [],
  });
});

test("buildFieldLinks returns stable encoded Explore links and real counts", () => {
  const items = [
    makeItem("geometry", "visualization", { tags: ["几何", "拓扑"] }),
    makeItem("calculus", "visualization", { tags: ["导数", "微积分"] }),
    makeItem("fourier", "article", { tags: ["傅里叶变换", "信号处理"] }),
  ];

  const links = buildFieldLinks(items);
  const geometry = links.find((link) => link.id === "geometry");
  const calculus = links.find((link) => link.id === "calculus");

  assert.equal(links.length, 5);
  assert.equal(geometry?.href, "/explore?tag=%E5%87%A0%E4%BD%95");
  assert.equal(geometry?.count, 1);
  assert.equal(calculus?.href, "/explore?tag=%E5%BE%AE%E7%A7%AF%E5%88%86");
  assert.equal(calculus?.count, 1);
});
