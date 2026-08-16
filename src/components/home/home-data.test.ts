import assert from "node:assert/strict";
import test from "node:test";
import type { FeedItem } from "../../types/index.ts";
// @ts-expect-error TS5097: Node's TypeScript test runner requires explicit extensions.
import { galleryMediaReducer } from "./gallery-media-state.ts";
// @ts-expect-error TS5097: Node's TypeScript test runner requires explicit extensions.
import { buildEditorialSlots, buildFieldLinks, buildSandboxHref, isGalleryHeaderScrolled, selectGalleryFeature } from "./home-data.ts";

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

test("selectGalleryFeature falls back to any content when no visualizations exist", () => {
  const items = [makeItem("article", "article")];

  assert.equal(selectGalleryFeature(items)?.id, "article");
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

test("isGalleryHeaderScrolled changes after the gallery threshold", () => {
  assert.equal(isGalleryHeaderScrolled(40, 1000), false);
  assert.equal(isGalleryHeaderScrolled(719, 1000), false);
  assert.equal(isGalleryHeaderScrolled(720, 1000), true);
  assert.equal(isGalleryHeaderScrolled(80, 0), true);
});

test("buildSandboxHref trims and encodes a mathematical prompt", () => {
  assert.equal(
    buildSandboxHref("  可视化 ∂f/∂x 的几何意义  "),
    "/sandbox?prompt=%E5%8F%AF%E8%A7%86%E5%8C%96%20%E2%88%82f%2F%E2%88%82x%20%E7%9A%84%E5%87%A0%E4%BD%95%E6%84%8F%E4%B9%89",
  );
});

test("buildSandboxHref rejects an empty prompt", () => {
  assert.equal(buildSandboxHref("   "), null);
});

test("gallery media failures always transition to the SVG fallback", () => {
  for (const state of ["checking", "video", "paused"] as const) {
    assert.equal(
      galleryMediaReducer(state, { type: "failed" }),
      "fallback",
    );
  }
});

test("a new media source resets the fallback to checking", () => {
  assert.equal(
    galleryMediaReducer("fallback", { type: "source-changed" }),
    "checking",
  );
});

test("late playback events cannot escape the fallback", () => {
  assert.equal(
    galleryMediaReducer("fallback", { type: "played" }),
    "fallback",
  );
  assert.equal(
    galleryMediaReducer("fallback", { type: "paused" }),
    "fallback",
  );
});
