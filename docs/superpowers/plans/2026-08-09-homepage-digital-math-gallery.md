# Mathiverse Digital Math Gallery Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Mathiverse homepage as a dark-to-light digital mathematics gallery with real-video-first media, an SVG fallback, asymmetric editorial content, Noto Sans SC typography, and a real prompt handoff into Sandbox.

**Architecture:** Keep `src/app/page.tsx` as a Server Component that fetches the existing hot feed and derives serializable homepage view data through pure helpers. Put only media playback, header scroll state, field-map interaction, and prompt submission behind focused Client Component boundaries. Preserve the existing Explore/Search `FeedGrid`, backend schema, auth, notification, publishing, and detail-page behavior.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript 5, CSS Modules, Tailwind CSS 4, Supabase, native `<video>`, inline SVG, Node 24.19 built-in `node:test`.

## Global Constraints

- Read and follow `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`, `05-server-and-client-components.md`, `03-api-reference/04-functions/use-search-params.md`, and `03-api-reference/03-file-conventions/page.md` before implementation.
- Use `Noto_Sans_SC` from `next/font/google` with only weights `400` and `500`, `display: "swap"`, a CSS variable, and `preload: false`; do not load fonts from a runtime CDN.
- Keep `src/app/page.tsx` server-rendered. Mark only interactive leaf components with `"use client"`.
- Do not add database migrations, runtime animation libraries, Canvas particles, Vitest, Testing Library, or DOM emulators.
- Test new behavior with Node 24.19 `node:test` and TypeScript type stripping before implementing it.
- Presentational TSX and CSS are verified with lint, typecheck, production build, browser inspection, and responsive screenshots.
- Preserve the user's existing `renderer/start.sh` modification and never stage `.superpowers/`.
- Never use the homepage-only `TiltCard`, gradient blobs, generic fly-in/bounce/float choreography, or the existing equal-width `FeedGrid`.
- Honor `prefers-reduced-motion`: no autoplay video and no looping SVG movement when reduction is requested.
- Keep every task's commit scoped to the files listed in that task.

---

## File Map

### Create

- `src/components/home/home-data.ts` — pure selection, layout, field-link, header-threshold, and Sandbox URL helpers.
- `src/components/home/home-data.test.ts` — Node built-in behavior tests for every helper.
- `src/components/home/home-gallery.module.css` — homepage-only tokens, layout, responsive composition, motion, and focus styling.
- `src/components/home/gallery-hero.tsx` — real-video-first hero state and accessible playback control.
- `src/components/home/mathematical-fallback.tsx` — inline SVG orbit fallback and its accessible description.
- `src/components/home/exhibition-index.tsx` — current/next/story editorial index.
- `src/components/home/math-field-map.tsx` — keyboard-accessible mathematical field navigation.
- `src/components/home/editorial-feed.tsx` — deterministic asymmetric homepage feed.
- `src/components/home/concept-prompt.tsx` — validated prompt input and Sandbox navigation.
- `src/app/sandbox/sandbox-content.tsx` — the existing interactive Sandbox implementation, moved behind a Server Page boundary.

### Modify

- `package.json` — add exact `test` and `typecheck` scripts without changing dependencies.
- `src/types/index.ts` — expose the existing visualization `videoUrl` on `FeedItem`.
- `src/lib/db/queries.ts` — map visualization `video_url` into feed items.
- `src/app/layout.tsx` — register Noto Sans SC while retaining fonts used by other routes.
- `src/components/layout/app-header.tsx` — add an optional gallery appearance without changing the default.
- `src/app/page.tsx` — replace the current SaaS hero/card composition with the new gallery narrative.
- `src/app/sandbox/page.tsx` — become a Next.js 16.3 Server Page that awaits `searchParams`.
- `src/components/sandbox/chat-panel.tsx` — accept a one-time `initialPrompt` as the textarea default.

---

### Task 1: Feed Media Contract and Featured Selection

**Files:**
- Create: `src/components/home/home-data.ts`
- Create: `src/components/home/home-data.test.ts`
- Modify: `src/types/index.ts`
- Modify: `src/lib/db/queries.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `FeedItem` values returned by `buildFeedItems(client, "hot")`.
- Produces: `selectGalleryFeature(items: FeedItem[]): FeedItem | null`.
- Produces: `FeedItem.videoUrl?: string | null`.
- Produces: package scripts `pnpm test` and `pnpm typecheck`.

- [ ] **Step 1: Add the exact test and typecheck scripts**

Add these scripts after `lint` in `package.json`:

```json
"lint": "eslint",
"typecheck": "tsc --noEmit",
"test": "node --test --experimental-strip-types src/components/home/home-data.test.ts"
```

- [ ] **Step 2: Write the failing featured-selection tests**

Create `src/components/home/home-data.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import type { FeedItem } from "../../types/index.ts";
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
```

- [ ] **Step 3: Run the test and verify the correct failure**

Run:

```bash
pnpm test
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/components/home/home-data.ts`.

- [ ] **Step 4: Implement the minimal featured selector**

Create `src/components/home/home-data.ts`:

```ts
import type { FeedItem } from "@/types";

export function selectGalleryFeature(items: FeedItem[]): FeedItem | null {
  return (
    items.find(
      (item) => item.type === "visualization" && Boolean(item.videoUrl),
    ) ??
    items.find((item) => item.type === "visualization") ??
    null
  );
}
```

Add this property to `FeedItem` in `src/types/index.ts`:

```ts
videoUrl?: string | null;
```

Add `videoUrl` to visualization feed mapping in `buildFeedItems` inside `src/lib/db/queries.ts`:

```ts
videoUrl: v.video_url ?? v.videoUrl ?? null,
```

Do not add `videoUrl` to article items.

- [ ] **Step 5: Run focused tests and static checks**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: all three commands exit 0.

- [ ] **Step 6: Commit the media contract**

```bash
git add package.json src/types/index.ts src/lib/db/queries.ts src/components/home/home-data.ts src/components/home/home-data.test.ts
git commit -m "feat: add homepage media selection"
```

---

### Task 2: Editorial Slots and Mathematical Field Links

**Files:**
- Modify: `src/components/home/home-data.ts`
- Modify: `src/components/home/home-data.test.ts`

**Interfaces:**
- Consumes: `FeedItem[]` and the result of `selectGalleryFeature`.
- Produces: `buildEditorialSlots(items, feature): EditorialSlots`.
- Produces: `buildFieldLinks(items): MathFieldLink[]`.
- `EditorialSlots` is `{ lead: FeedItem | null; story: FeedItem | null; supporting: FeedItem[] }`.
- `MathFieldLink` is `{ id; label; labelZh; tag; href; accent; count }`.

- [ ] **Step 1: Append failing layout and field-link tests**

Update the import in `home-data.test.ts`:

```ts
import {
  buildEditorialSlots,
  buildFieldLinks,
  selectGalleryFeature,
} from "./home-data.ts";
```

Append these tests:

```ts
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
```

- [ ] **Step 2: Run the tests and verify missing-export failures**

Run:

```bash
pnpm test
```

Expected: FAIL because `buildEditorialSlots` and `buildFieldLinks` are not exported.

- [ ] **Step 3: Implement deterministic slots and field definitions**

Append to `home-data.ts`:

```ts
export interface EditorialSlots {
  lead: FeedItem | null;
  story: FeedItem | null;
  supporting: FeedItem[];
}

export interface MathFieldLink {
  id: "geometry" | "calculus" | "algebra" | "probability" | "analysis";
  label: string;
  labelZh: string;
  tag: string;
  href: string;
  accent: "green" | "orange" | "blue";
  count: number;
}

const FIELD_DEFINITIONS: Array<
  Omit<MathFieldLink, "href" | "count"> & { keywords: string[] }
> = [
  {
    id: "geometry",
    label: "Geometry",
    labelZh: "几何",
    tag: "几何",
    accent: "green",
    keywords: ["几何", "拓扑", "图形", "椭圆曲线"],
  },
  {
    id: "calculus",
    label: "Calculus",
    labelZh: "微积分",
    tag: "微积分",
    accent: "orange",
    keywords: ["微积分", "导数", "积分", "极限"],
  },
  {
    id: "algebra",
    label: "Algebra",
    labelZh: "代数",
    tag: "线性代数",
    accent: "blue",
    keywords: ["代数", "矩阵", "线性代数"],
  },
  {
    id: "probability",
    label: "Probability",
    labelZh: "概率",
    tag: "概率分布",
    accent: "orange",
    keywords: ["概率", "统计", "分布"],
  },
  {
    id: "analysis",
    label: "Analysis",
    labelZh: "分析",
    tag: "傅里叶变换",
    accent: "green",
    keywords: ["傅里叶", "信号", "级数"],
  },
];

function sameItem(left: FeedItem, right: FeedItem | null): boolean {
  return Boolean(
    right && left.id === right.id && left.type === right.type,
  );
}

export function buildEditorialSlots(
  items: FeedItem[],
  feature: FeedItem | null,
): EditorialSlots {
  const available = items.filter((item) => !sameItem(item, feature));
  const lead =
    available.find((item) => item.type === "visualization") ??
    available[0] ??
    null;
  const story =
    available.find(
      (item) => item.type === "article" && !sameItem(item, lead),
    ) ?? null;
  const supporting = available
    .filter((item) => !sameItem(item, lead) && !sameItem(item, story))
    .slice(0, 4);

  return { lead, story, supporting };
}

export function buildFieldLinks(items: FeedItem[]): MathFieldLink[] {
  return FIELD_DEFINITIONS.map(({ keywords, ...field }) => {
    const count = items.filter((item) =>
      item.tags.some((tag) =>
        keywords.some((keyword) => tag.includes(keyword)),
      ),
    ).length;

    return {
      ...field,
      href: `/explore?tag=${encodeURIComponent(field.tag)}`,
      count,
    };
  });
}
```

- [ ] **Step 4: Run tests and checks**

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the deterministic homepage data model**

```bash
git add src/components/home/home-data.ts src/components/home/home-data.test.ts
git commit -m "feat: derive homepage editorial layout"
```

---

### Task 3: Noto Sans SC and the Mixed-Media Gallery Hero

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/home/home-gallery.module.css`
- Create: `src/components/home/mathematical-fallback.tsx`
- Create: `src/components/home/gallery-hero.tsx`

**Interfaces:**
- Consumes: `feature: FeedItem | null` from `selectGalleryFeature`.
- Produces: `<GalleryHero feature={feature} />`.
- Produces: CSS variable `--font-noto-sans-sc`.
- Client media states are exactly `checking`, `video`, `fallback`, and `paused` through booleans derived in the component.

- [ ] **Step 1: Register Noto Sans SC with the Next.js 16.3 font API**

Update the import in `src/app/layout.tsx`:

```ts
import {
  Cormorant_Garamond,
  Inter,
  JetBrains_Mono,
  Noto_Sans_SC,
} from "next/font/google";
```

Add the font definition:

```ts
const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: ["400", "500"],
  display: "swap",
  preload: false,
});
```

Add `${notoSansSC.variable}` to the existing `<html>` class list. Retain Inter, JetBrains Mono, and Cormorant Garamond because other routes still use them.

- [ ] **Step 2: Create the homepage CSS-module foundation**

Create `home-gallery.module.css` with these exact root tokens and structural rules first:

```css
.page {
  --gallery-black: #0b0f0c;
  --archive-paper: #f2f3ed;
  --mathematical-ink: #121510;
  --function-blue: #4169ff;
  --orbit-green: #25bea5;
  --calculus-orange: #ff603b;
  --gallery-line-dark: rgba(242, 243, 237, 0.2);
  --gallery-line-light: rgba(18, 21, 16, 0.22);
  min-height: 100vh;
  overflow: clip;
  background: var(--archive-paper);
  color: var(--mathematical-ink);
  font-family: var(--font-noto-sans-sc), var(--font-inter), sans-serif;
}

.darkStage {
  background: var(--gallery-black);
  color: var(--archive-paper);
}

.monoLabel {
  font-family: var(--font-jetbrains-mono), monospace;
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.focusLink:focus-visible,
.mediaControl:focus-visible,
.promptInput:focus-visible,
.promptSubmit:focus-visible {
  outline: 2px solid var(--function-blue);
  outline-offset: 4px;
}
```

Do not define rounded card, drop-shadow, backdrop-blur, spring, float, or hover-lift utilities.

- [ ] **Step 3: Implement the accessible SVG fallback**

Create `mathematical-fallback.tsx` as a Server-compatible component with this interface and SVG structure:

```tsx
import styles from "./home-gallery.module.css";

export function MathematicalFallback() {
  return (
    <svg
      className={styles.orbitFallback}
      viewBox="0 0 960 640"
      role="img"
      aria-labelledby="orbit-title orbit-desc"
    >
      <title id="orbit-title">三体运动轨道</title>
      <desc id="orbit-desc">
        三个数学质点沿不同椭圆轨道缓慢运动，展示轨道、引力与连续变化。
      </desc>
      <g className={styles.orbitSystem} transform="translate(520 300)">
        <ellipse className={styles.orbitOne} rx="330" ry="112" />
        <ellipse className={styles.orbitTwo} rx="230" ry="230" />
        <ellipse className={styles.orbitThree} rx="370" ry="70" />
        <circle className={styles.orbitCore} r="30" />
        <circle className={styles.orbitPointOne} r="10" />
        <circle className={styles.orbitPointTwo} r="9" />
        <circle className={styles.orbitPointThree} r="9" />
      </g>
      <text className={styles.orbitAnnotation} x="56" y="80">
        STUDY 001 / THREE BODY ORBIT
      </text>
    </svg>
  );
}
```

Add CSS for neutral orbit strokes, three semantic point colors, transform-only point motion, and a static reduced-motion frame:

```css
.orbitFallback { width: 100%; height: 100%; display: block; }
.orbitOne, .orbitTwo, .orbitThree {
  fill: none;
  stroke: rgba(242, 243, 237, 0.24);
  stroke-width: 1.5;
  transform-origin: center;
}
.orbitOne { transform: rotate(-18deg); }
.orbitTwo { transform: rotate(32deg); }
.orbitThree { transform: rotate(66deg); }
.orbitCore { fill: var(--archive-paper); }
.orbitPointOne { fill: var(--calculus-orange); animation: orbit-point-one 18s linear infinite; }
.orbitPointTwo { fill: var(--orbit-green); animation: orbit-point-two 24s linear infinite; }
.orbitPointThree { fill: var(--function-blue); animation: orbit-point-three 30s linear infinite; }
.orbitAnnotation { fill: rgba(242, 243, 237, 0.58); font: 500 12px var(--font-jetbrains-mono); letter-spacing: 0.14em; }
@keyframes orbit-point-one {
  from { transform: rotate(0deg) translateX(330px) rotate(0deg); }
  to { transform: rotate(360deg) translateX(330px) rotate(-360deg); }
}
@keyframes orbit-point-two {
  from { transform: rotate(120deg) translateX(230px) rotate(-120deg); }
  to { transform: rotate(480deg) translateX(230px) rotate(-480deg); }
}
@keyframes orbit-point-three {
  from { transform: rotate(240deg) translateX(370px) rotate(-240deg); }
  to { transform: rotate(600deg) translateX(370px) rotate(-600deg); }
}
@media (prefers-reduced-motion: reduce) {
  .orbitPointOne, .orbitPointTwo, .orbitPointThree { animation: none; }
  .orbitPointOne { transform: translate(250px, -90px); }
  .orbitPointTwo { transform: translate(-160px, 150px); }
  .orbitPointThree { transform: translate(80px, 210px); }
}
```

- [ ] **Step 4: Implement the focused Client Component for media state**

Create `gallery-hero.tsx` with these imports, props, and state transitions:

```tsx
"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/types";
import { MathematicalFallback } from "./mathematical-fallback";
import styles from "./home-gallery.module.css";

interface GalleryHeroProps {
  feature: FeedItem | null;
}

export function GalleryHero({ feature }: GalleryHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const showVideo = Boolean(
    feature?.videoUrl && reducedMotion === false && !videoFailed,
  );

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  };

  const title = feature?.title ?? "轨道、引力与三体运动";
  const description =
    feature?.description ?? "看见数学对象如何在时间中改变、相遇与形成结构。";
  const href = feature ? `/v/${feature.id}` : "/sandbox";

  return (
    <section className={styles.galleryHero} aria-labelledby="gallery-title">
      <div className={styles.heroMedia}>
        {showVideo ? (
          <video
            ref={videoRef}
            className={styles.heroVideo}
            src={feature?.videoUrl ?? undefined}
            poster={feature?.posterUrl ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
            onPause={() => setPaused(true)}
            onPlay={() => setPaused(false)}
          />
        ) : (
          <MathematicalFallback />
        )}
      </div>
      <div className={styles.heroScrim} aria-hidden="true" />
      <div className={styles.heroCopy}>
        <p className={`${styles.monoLabel} ${styles.heroIndex}`}>
          NOW SHOWING / 01
        </p>
        <h1 id="gallery-title" className={styles.heroTitle}>{title}</h1>
        <p className={styles.heroDescription}>{description}</p>
        <div className={styles.heroActions}>
          <Link className={styles.heroPrimary} href="/sandbox">开始创作</Link>
          <Link className={styles.focusLink} href={href}>查看展品</Link>
        </div>
      </div>
      {showVideo && (
        <button
          type="button"
          className={styles.mediaControl}
          onClick={togglePlayback}
          aria-label={paused ? "播放主展品" : "暂停主展品"}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          <span>{paused ? "播放" : "暂停"}</span>
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Add hero layout CSS without card chrome**

Add `.galleryHero`, `.heroMedia`, `.heroVideo`, `.heroScrim`, `.heroCopy`, `.heroTitle`, `.heroDescription`, `.heroActions`, `.heroPrimary`, and `.mediaControl` to the CSS Module. Use these exact constraints:

```css
.galleryHero { position: relative; min-height: 92svh; overflow: hidden; background: var(--gallery-black); }
.heroMedia, .heroVideo { position: absolute; inset: 0; width: 100%; height: 100%; }
.heroVideo { object-fit: cover; }
.heroScrim { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(5, 8, 5, 0.72), rgba(5, 8, 5, 0.08) 70%), linear-gradient(0deg, rgba(5, 8, 5, 0.54), transparent 48%); }
.heroCopy { position: relative; z-index: 1; min-height: 92svh; max-width: 84rem; margin: 0 auto; padding: 9rem 2rem 3rem; display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-end; }
.heroTitle { max-width: 13ch; margin: 1.25rem 0 1rem; font-size: clamp(3.5rem, 9vw, 8.5rem); font-weight: 500; line-height: 0.88; letter-spacing: -0.065em; text-wrap: balance; }
.heroDescription { max-width: 34rem; margin: 0; color: rgba(242, 243, 237, 0.76); font-size: clamp(0.95rem, 1.5vw, 1.15rem); line-height: 1.65; }
.heroActions { display: flex; flex-wrap: wrap; align-items: center; gap: 1.25rem; margin-top: 1.75rem; }
.heroPrimary { padding: 0.75rem 1rem; background: var(--archive-paper); color: var(--gallery-black); }
.mediaControl { position: absolute; right: 2rem; bottom: 2rem; z-index: 2; display: inline-flex; align-items: center; gap: 0.5rem; border: 0; background: transparent; color: var(--archive-paper); }
```

- [ ] **Step 6: Verify the hero compiles and commit**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit 0; the build emits no font, hydration, or media warnings.

Commit:

```bash
git add src/app/layout.tsx src/components/home/home-gallery.module.css src/components/home/mathematical-fallback.tsx src/components/home/gallery-hero.tsx
git commit -m "feat: build mixed-media gallery hero"
```

---

### Task 4: Gallery-Aware Header Behavior

**Files:**
- Modify: `src/components/home/home-data.ts`
- Modify: `src/components/home/home-data.test.ts`
- Modify: `src/components/layout/app-header.tsx`

**Interfaces:**
- Produces: `isGalleryHeaderScrolled(scrollY: number, viewportHeight: number): boolean`.
- Produces: `<AppHeader appearance="gallery" />` while preserving `<AppHeader />` behavior.

- [ ] **Step 1: Add a failing threshold test**

Update the test import to include `isGalleryHeaderScrolled`, then append:

```ts
test("isGalleryHeaderScrolled changes after the gallery threshold", () => {
  assert.equal(isGalleryHeaderScrolled(40, 1000), false);
  assert.equal(isGalleryHeaderScrolled(719, 1000), false);
  assert.equal(isGalleryHeaderScrolled(720, 1000), true);
  assert.equal(isGalleryHeaderScrolled(80, 0), true);
});
```

- [ ] **Step 2: Run the test and verify the missing-export failure**

```bash
pnpm test
```

Expected: FAIL because `isGalleryHeaderScrolled` is not exported.

- [ ] **Step 3: Implement the pure threshold helper**

Append to `home-data.ts`:

```ts
export function isGalleryHeaderScrolled(
  scrollY: number,
  viewportHeight: number,
): boolean {
  return scrollY >= Math.max(80, viewportHeight * 0.72);
}
```

- [ ] **Step 4: Add the optional gallery appearance**

Change the header signature and scroll effect in `app-header.tsx`:

```tsx
import { isGalleryHeaderScrolled } from "@/components/home/home-data";

interface AppHeaderProps {
  appearance?: "default" | "gallery";
}

export function AppHeader({ appearance = "default" }: AppHeaderProps) {
```

Replace the existing scroll effect with:

```tsx
useEffect(() => {
  const onScroll = () => {
    setScrolled(
      appearance === "gallery"
        ? isGalleryHeaderScrolled(window.scrollY, window.innerHeight)
        : window.scrollY > 20,
    );
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  };
}, [appearance]);
```

Define:

```ts
const galleryAtTop = appearance === "gallery" && !scrolled;
```

Use it to select transparent dark-stage classes at the top and the existing paper header after the threshold. Keep the default class branch byte-for-byte equivalent to current behavior. Apply `text-[#f2f3ed]` to top-state logo/nav/auth controls and `border-white/20` to the compact CTA; do not add backdrop blur at the top.

- [ ] **Step 5: Verify default behavior and commit**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: all commands exit 0.

Commit:

```bash
git add src/components/home/home-data.ts src/components/home/home-data.test.ts src/components/layout/app-header.tsx
git commit -m "feat: add gallery header appearance"
```

---

### Task 5: Exhibition Index, Field Map, Editorial Feed, and Server Page

**Files:**
- Create: `src/components/home/exhibition-index.tsx`
- Create: `src/components/home/math-field-map.tsx`
- Create: `src/components/home/editorial-feed.tsx`
- Modify: `src/components/home/home-gallery.module.css`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `feature`, `EditorialSlots`, and `MathFieldLink[]` produced by Tasks 1–2.
- Produces: a complete homepage except for the final concept prompt implemented in Task 6.
- `ExhibitionIndex` props: `{ feature; next; story }` where every item is `FeedItem | null`.
- `MathFieldMap` props: `{ fields: MathFieldLink[] }`.
- `EditorialFeed` props: `{ slots: EditorialSlots }`.

- [ ] **Step 1: Implement the unboxed exhibition index**

Create `exhibition-index.tsx` as a Server Component. Render a semantic `<section>` with three direct children separated by CSS rules:

```tsx
import Link from "next/link";
import type { FeedItem } from "@/types";
import styles from "./home-gallery.module.css";

interface ExhibitionIndexProps {
  feature: FeedItem | null;
  next: FeedItem | null;
  story: FeedItem | null;
}

function itemHref(item: FeedItem): string {
  return item.type === "visualization" ? `/v/${item.id}` : `/a/${item.id}`;
}

export function ExhibitionIndex({
  feature,
  next,
  story,
}: ExhibitionIndexProps) {
  const entries = [
    { label: "NOW SHOWING / 01", item: feature, fallback: "Living Mathematics" },
    { label: "NEXT / 02", item: next, fallback: "Create the next study" },
    { label: "COMMUNITY NOTE", item: story, fallback: "Ideas become motion" },
  ];

  return (
    <section className={styles.exhibitionIndex} aria-label="展览索引">
      {entries.map((entry) => (
        <div className={styles.indexEntry} key={entry.label}>
          <span className={styles.monoLabel}>{entry.label}</span>
          {entry.item ? (
            <Link className={styles.indexLink} href={itemHref(entry.item)}>
              {entry.item.title}
            </Link>
          ) : (
            <span className={styles.indexFallback}>{entry.fallback}</span>
          )}
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Implement keyboard-accessible field navigation**

Create `math-field-map.tsx` as a Server Component. Every field is a real `Link`; decorative diagrams are `aria-hidden`:

```tsx
import Link from "next/link";
import type { MathFieldLink } from "./home-data";
import styles from "./home-gallery.module.css";

export function MathFieldMap({ fields }: { fields: MathFieldLink[] }) {
  return (
    <section className={styles.fieldSection} aria-labelledby="field-title">
      <div className={styles.sectionHeading}>
        <span className={styles.monoLabel}>EXPLORE / MATHEMATICAL FIELDS</span>
        <h2 id="field-title">沿着关系，进入数学</h2>
      </div>
      <div className={styles.fieldMap}>
        <svg className={styles.fieldLines} viewBox="0 0 1000 420" aria-hidden="true">
          <path d="M120 120 C310 40 430 240 590 140 S820 80 900 220" />
          <path d="M120 300 C280 180 450 360 620 270 S820 320 900 160" />
        </svg>
        {fields.map((field, index) => (
          <Link
            className={`${styles.fieldNode} ${styles[`fieldNode${index + 1}`]}`}
            data-accent={field.accent}
            href={field.href}
            key={field.id}
          >
            <span className={styles.fieldPoint} aria-hidden="true" />
            <span
              className={styles.fieldConstruction}
              data-field={field.id}
              aria-hidden="true"
            />
            <span className={styles.fieldName}>{field.label}</span>
            <span className={styles.fieldNameZh}>{field.labelZh}</span>
            {field.count > 0 && (
              <span className={styles.fieldCount}>{field.count} 件作品</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Implement the deterministic editorial feed**

Create `editorial-feed.tsx`. Use one internal `EditorialItem` renderer and semantic variants, not generic cards:

```tsx
import Link from "next/link";
import { GenerativeThumbnail } from "@/components/content/generative-thumbnail";
import type { FeedItem } from "@/types";
import type { EditorialSlots } from "./home-data";
import styles from "./home-gallery.module.css";

function itemHref(item: FeedItem): string {
  return item.type === "visualization" ? `/v/${item.id}` : `/a/${item.id}`;
}

function EditorialItem({
  item,
  variant,
}: {
  item: FeedItem;
  variant: "lead" | "story" | "supporting";
}) {
  return (
    <article className={styles[`${variant}Item`]}>
      <Link className={styles.editorialLink} href={itemHref(item)}>
        {variant !== "story" && (
          <div className={styles.editorialVisual}>
            <GenerativeThumbnail tags={item.tags} className={styles.editorialArtwork} />
          </div>
        )}
        <div className={styles.editorialCopy}>
          <span className={styles.monoLabel}>
            {item.type === "visualization" ? "VISUAL STUDY" : "ESSAY"}
          </span>
          <h3>{item.title}</h3>
          {item.description && <p>{item.description}</p>}
          <span className={styles.editorialAuthor}>{item.author.displayName}</span>
        </div>
      </Link>
    </article>
  );
}

export function EditorialFeed({ slots }: { slots: EditorialSlots }) {
  if (!slots.lead && !slots.story && slots.supporting.length === 0) return null;

  return (
    <section className={styles.communitySection} aria-labelledby="community-title">
      <div className={styles.sectionHeading}>
        <span className={styles.monoLabel}>COMMUNITY / SELECTED WORKS</span>
        <h2 id="community-title">社区正在研究什么</h2>
      </div>
      <div className={styles.editorialGrid}>
        {slots.lead && <EditorialItem item={slots.lead} variant="lead" />}
        {slots.story && <EditorialItem item={slots.story} variant="story" />}
        {slots.supporting.map((item) => (
          <EditorialItem
            item={item}
            key={`${item.type}-${item.id}`}
            variant="supporting"
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Compose the Server Component homepage**

Replace `src/app/page.tsx` with this composition, leaving the final prompt slot for Task 6:

```tsx
import { AppHeader } from "@/components/layout/app-header";
import { EditorialFeed } from "@/components/home/editorial-feed";
import { ExhibitionIndex } from "@/components/home/exhibition-index";
import { GalleryHero } from "@/components/home/gallery-hero";
import {
  buildEditorialSlots,
  buildFieldLinks,
  selectGalleryFeature,
} from "@/components/home/home-data";
import { MathFieldMap } from "@/components/home/math-field-map";
import { buildFeedItems } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/home/home-gallery.module.css";

export default async function Home() {
  const supabase = await createClient();
  const feedItems = supabase ? await buildFeedItems(supabase, "hot") : [];
  const feature = selectGalleryFeature(feedItems);
  const slots = buildEditorialSlots(feedItems, feature);
  const fields = buildFieldLinks(feedItems);

  return (
    <div className={styles.page}>
      <div className={styles.darkStage}>
        <AppHeader appearance="gallery" />
        <GalleryHero feature={feature} />
        <ExhibitionIndex
          feature={feature}
          next={slots.lead}
          story={slots.story}
        />
      </div>
      <main className={styles.lightStage}>
        <MathFieldMap fields={fields} />
        <EditorialFeed slots={slots} />
        <div id="concept-prompt-slot" />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Add strict twelve-column and responsive CSS**

Add CSS Module rules with these structural values:

```css
.exhibitionIndex { display: grid; grid-template-columns: 1.35fr 0.8fr 0.85fr; border-top: 1px solid var(--gallery-line-dark); border-bottom: 1px solid var(--gallery-line-dark); }
.indexEntry { min-height: 10rem; padding: 1.5rem 2rem; border-right: 1px solid var(--gallery-line-dark); display: flex; flex-direction: column; justify-content: space-between; }
.indexLink, .indexFallback { max-width: 24ch; color: inherit; font-size: clamp(1.1rem, 2vw, 1.65rem); line-height: 1.25; }
.lightStage { background: var(--archive-paper); color: var(--mathematical-ink); }
.fieldSection, .communitySection { max-width: 84rem; margin: 0 auto; padding: 8rem 2rem; }
.sectionHeading { display: grid; grid-template-columns: 4fr 8fr; gap: 2rem; align-items: end; margin-bottom: 4rem; border-bottom: 1px solid var(--gallery-line-light); padding-bottom: 1.25rem; }
.sectionHeading h2 { margin: 0; font-size: clamp(2.5rem, 6vw, 5.75rem); font-weight: 500; line-height: 0.95; letter-spacing: -0.055em; }
.fieldMap { position: relative; min-height: 30rem; }
.fieldLines { position: absolute; inset: 0; width: 100%; height: 100%; fill: none; stroke: var(--gallery-line-light); }
.fieldNode { position: absolute; isolation: isolate; display: grid; gap: 0.2rem; color: inherit; }
.fieldNode1 { left: 6%; top: 15%; } .fieldNode2 { left: 33%; top: 52%; } .fieldNode3 { left: 57%; top: 18%; } .fieldNode4 { right: 6%; top: 58%; } .fieldNode5 { left: 72%; top: 7%; }
.fieldPoint { width: 0.625rem; height: 0.625rem; margin-bottom: 0.75rem; border-radius: 50%; background: var(--function-blue); }
.fieldNode[data-accent="green"] .fieldPoint { background: var(--orbit-green); }
.fieldNode[data-accent="orange"] .fieldPoint { background: var(--calculus-orange); }
.fieldConstruction { position: absolute; z-index: -1; left: -2.5rem; top: -2.5rem; width: 8rem; height: 8rem; opacity: 0; transform: scale(0.86) rotate(-5deg); transition: opacity 180ms ease, transform 180ms ease; pointer-events: none; }
.fieldConstruction::before, .fieldConstruction::after { content: ""; position: absolute; inset: 0.75rem; border: 1px solid currentColor; }
.fieldConstruction[data-field="geometry"]::before { border-radius: 50%; }
.fieldConstruction[data-field="geometry"]::after { inset: 2rem 0.5rem; border-width: 1px 0 0; transform: rotate(-24deg); }
.fieldConstruction[data-field="calculus"]::before { inset: 1rem 0.5rem 2rem; border-width: 0 0 1px 1px; transform: skewY(-18deg); }
.fieldConstruction[data-field="calculus"]::after { inset: 3rem 0.25rem; border-width: 1px 0 0; transform: rotate(18deg); }
.fieldConstruction[data-field="algebra"] { background-image: linear-gradient(var(--gallery-line-light) 1px, transparent 1px), linear-gradient(90deg, var(--gallery-line-light) 1px, transparent 1px); background-size: 1.25rem 1.25rem; }
.fieldConstruction[data-field="probability"] { background: radial-gradient(circle at 25% 35%, currentColor 0 2px, transparent 3px), radial-gradient(circle at 62% 20%, currentColor 0 2px, transparent 3px), radial-gradient(circle at 72% 68%, currentColor 0 2px, transparent 3px), radial-gradient(circle at 38% 78%, currentColor 0 2px, transparent 3px); }
.fieldConstruction[data-field="analysis"]::before { inset: 2rem 0.5rem; border-width: 1px 0 0; border-radius: 50%; transform: rotate(-12deg) skewY(28deg); }
.fieldConstruction[data-field="analysis"]::after { inset: 0.5rem 3.9rem; border-width: 0 0 0 1px; }
.fieldNode:hover .fieldConstruction, .fieldNode:focus-visible .fieldConstruction { opacity: 0.38; transform: scale(1) rotate(0); }
.fieldName { font-size: clamp(1.35rem, 2.5vw, 2.4rem); font-weight: 500; letter-spacing: -0.04em; }
.fieldNameZh, .fieldCount { color: rgba(18, 21, 16, 0.62); }
.editorialGrid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 1px; background: var(--gallery-line-light); border-top: 1px solid var(--gallery-line-light); border-bottom: 1px solid var(--gallery-line-light); }
.leadItem { grid-column: span 8; min-height: 36rem; background: var(--archive-paper); }
.storyItem { grid-column: span 4; min-height: 36rem; background: var(--archive-paper); }
.supportingItem { grid-column: span 4; min-height: 24rem; background: var(--archive-paper); }
.editorialLink { height: 100%; display: flex; flex-direction: column; color: inherit; }
.editorialVisual { flex: 1; min-height: 16rem; overflow: hidden; }
.editorialArtwork { width: 100%; height: 100%; }
.editorialCopy { padding: 1.5rem; }
.editorialCopy h3 { margin: 1.25rem 0 0.75rem; font-size: clamp(1.5rem, 3vw, 2.75rem); font-weight: 500; line-height: 1.05; letter-spacing: -0.045em; }
```

Add responsive rules that recompose rather than only stack cards:

```css
@media (max-width: 900px) {
  .exhibitionIndex { grid-template-columns: 1fr 1fr; }
  .indexEntry:first-child { grid-column: 1 / -1; }
  .sectionHeading { grid-template-columns: 1fr; }
  .leadItem { grid-column: span 12; }
  .storyItem, .supportingItem { grid-column: span 6; }
}
@media (max-width: 640px) {
  .heroCopy { min-height: 82svh; padding: 7rem 1rem 1.5rem; }
  .galleryHero { min-height: 82svh; }
  .exhibitionIndex { grid-template-columns: 1fr; }
  .indexEntry, .indexEntry:first-child { grid-column: auto; min-height: 7.5rem; padding: 1.25rem 1rem; }
  .fieldSection, .communitySection { padding: 5rem 1rem; }
  .fieldMap { min-height: 34rem; }
  .fieldLines { opacity: 0.55; }
  .fieldNode1 { left: 0; top: 4%; } .fieldNode2 { left: 38%; top: 23%; } .fieldNode3 { left: 5%; top: 43%; } .fieldNode4 { right: 0; top: 64%; } .fieldNode5 { left: 18%; top: 83%; }
  .leadItem, .storyItem, .supportingItem { grid-column: span 12; min-height: auto; }
  .leadItem { order: 1; } .storyItem { order: 2; } .supportingItem { order: 3; }
}
@media (prefers-reduced-motion: reduce) {
  .fieldConstruction { transition: none; }
}
```

- [ ] **Step 6: Run full checks and commit the complete homepage narrative**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit 0; `/`, `/explore?tag=几何`, and existing content links compile.

Commit:

```bash
git add src/app/page.tsx src/components/home/exhibition-index.tsx src/components/home/math-field-map.tsx src/components/home/editorial-feed.tsx src/components/home/home-gallery.module.css
git commit -m "feat: compose digital math gallery homepage"
```

---

### Task 6: Real Prompt Handoff Into Sandbox

**Files:**
- Modify: `src/components/home/home-data.ts`
- Modify: `src/components/home/home-data.test.ts`
- Create: `src/components/home/concept-prompt.tsx`
- Modify: `src/components/home/home-gallery.module.css`
- Modify: `src/app/page.tsx`
- Create: `src/app/sandbox/sandbox-content.tsx`
- Modify: `src/app/sandbox/page.tsx`
- Modify: `src/components/sandbox/chat-panel.tsx`

**Interfaces:**
- Produces: `buildSandboxHref(prompt: string): string | null`.
- Produces: `<ConceptPrompt />`.
- Produces: `<SandboxContent forkId initialPrompt />`.
- Produces: `<ChatPanel initialPrompt="..." />` with no automatic send.

- [ ] **Step 1: Add failing URL-generation tests**

Update the test import to include `buildSandboxHref`, then append:

```ts
test("buildSandboxHref trims and encodes a mathematical prompt", () => {
  assert.equal(
    buildSandboxHref("  可视化 ∂f/∂x 的几何意义  "),
    "/sandbox?prompt=%E5%8F%AF%E8%A7%86%E5%8C%96%20%E2%88%82f%2F%E2%88%82x%20%E7%9A%84%E5%87%A0%E4%BD%95%E6%84%8F%E4%B9%89",
  );
});

test("buildSandboxHref rejects an empty prompt", () => {
  assert.equal(buildSandboxHref("   "), null);
});
```

- [ ] **Step 2: Run the test and verify the missing-export failure**

```bash
pnpm test
```

Expected: FAIL because `buildSandboxHref` is not exported.

- [ ] **Step 3: Implement the minimal pure URL builder**

Append to `home-data.ts`:

```ts
export function buildSandboxHref(prompt: string): string | null {
  const normalized = prompt.trim();
  return normalized
    ? `/sandbox?prompt=${encodeURIComponent(normalized)}`
    : null;
}
```

Run `pnpm test`; expected PASS.

- [ ] **Step 4: Implement the validated prompt component**

Create `concept-prompt.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { buildSandboxHref } from "./home-data";
import styles from "./home-gallery.module.css";

export function ConceptPrompt() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const href = buildSandboxHref(prompt);
    if (!href) {
      setError("请输入一个你想看见的数学概念。");
      return;
    }
    setError("");
    router.push(href);
  };

  return (
    <section className={styles.promptSection} aria-labelledby="prompt-title">
      <span className={styles.monoLabel}>CREATE / FROM AN IDEA</span>
      <h2 id="prompt-title">你想看见什么？</h2>
      <form className={styles.promptForm} onSubmit={submit} noValidate>
        <label className={styles.promptLabel} htmlFor="math-concept">
          描述一个数学概念
        </label>
        <div className={styles.promptRow}>
          <input
            id="math-concept"
            className={styles.promptInput}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="例如：导数的几何意义"
            aria-describedby={error ? "prompt-error" : undefined}
            aria-invalid={Boolean(error)}
          />
          <button className={styles.promptSubmit} type="submit">
            在 Sandbox 中继续 →
          </button>
        </div>
        {error && <p id="prompt-error" className={styles.promptError}>{error}</p>}
      </form>
    </section>
  );
}
```

Replace `<div id="concept-prompt-slot" />` in `page.tsx` with `<ConceptPrompt />` and add its import.

- [ ] **Step 5: Move existing Sandbox interactivity behind a Server Page**

Copy the current contents of `src/app/sandbox/page.tsx` into `src/app/sandbox/sandbox-content.tsx`. Keep the existing `"use client"` directive and all current render, fork, chat, video, publish, and AI-fix behavior.

Make these exact changes in `sandbox-content.tsx`:

```tsx
interface SandboxContentProps {
  forkId: string | null;
  initialPrompt: string;
}

export function SandboxContent({
  forkId,
  initialPrompt,
}: SandboxContentProps) {
```

Remove the `useSearchParams` import and these current lines:

```ts
const searchParams = useSearchParams();
const forkId = searchParams.get("fork");
```

Pass the prompt to ChatPanel:

```tsx
<ChatPanel
  messages={messages}
  isLoading={isLoading}
  onSend={handleSend}
  onCancel={cancelSend}
  onClear={clearMessages}
  initialPrompt={initialPrompt}
  className="h-full"
/>
```

Replace `src/app/sandbox/page.tsx` with the Next.js 16.3 Server Page:

```tsx
import { SandboxContent } from "./sandbox-content";

type SandboxSearchParams = Promise<{
  fork?: string | string[];
  prompt?: string | string[];
}>;

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SandboxPage({
  searchParams,
}: {
  searchParams: SandboxSearchParams;
}) {
  const query = await searchParams;
  return (
    <SandboxContent
      forkId={firstValue(query.fork) || null}
      initialPrompt={firstValue(query.prompt)}
    />
  );
}
```

- [ ] **Step 6: Make ChatPanel accept a one-time uncontrolled default**

Add to `ChatPanelProps`:

```ts
initialPrompt?: string;
```

Default it in the component signature:

```ts
initialPrompt = "",
```

Add this prop to the existing `<Textarea>`:

```tsx
defaultValue={initialPrompt}
```

Do not add an effect that sends or rewrites the textarea after mount.

- [ ] **Step 7: Add unboxed prompt styling**

Append exact structural rules to the CSS Module:

```css
.promptSection { max-width: 84rem; margin: 0 auto; padding: 7rem 2rem 9rem; border-top: 1px solid var(--gallery-line-light); }
.promptSection h2 { max-width: 12ch; margin: 1.5rem 0 3rem; font-size: clamp(3rem, 8vw, 7rem); font-weight: 500; line-height: 0.9; letter-spacing: -0.06em; }
.promptForm { max-width: 64rem; }
.promptLabel { display: block; margin-bottom: 0.75rem; }
.promptRow { display: grid; grid-template-columns: minmax(0, 1fr) auto; border-bottom: 1px solid var(--mathematical-ink); }
.promptInput { min-width: 0; border: 0; background: transparent; color: inherit; padding: 1rem 0; font: inherit; font-size: clamp(1.1rem, 2.5vw, 1.75rem); }
.promptSubmit { border: 0; background: transparent; color: inherit; padding: 1rem 0 1rem 2rem; font: inherit; font-weight: 500; }
.promptError { color: #a52f24; margin: 0.75rem 0 0; }
@media (max-width: 640px) {
  .promptSection { padding: 5rem 1rem 6rem; }
  .promptRow { grid-template-columns: 1fr; }
  .promptSubmit { padding-left: 0; text-align: left; }
}
```

- [ ] **Step 8: Verify the complete handoff and commit**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit 0; the production build does not report a missing Suspense boundary because the Server Page awaits `searchParams`.

Manually verify:

1. Submit `导数的几何意义` on `/`.
2. Confirm navigation to `/sandbox?prompt=...`.
3. Confirm the ChatPanel textarea contains the phrase.
4. Confirm no chat request starts until the user clicks `发送`.
5. Confirm `/sandbox?fork=<id>` still loads source code.

Commit:

```bash
git add src/components/home/home-data.ts src/components/home/home-data.test.ts src/components/home/concept-prompt.tsx src/components/home/home-gallery.module.css src/app/page.tsx src/app/sandbox/page.tsx src/app/sandbox/sandbox-content.tsx src/components/sandbox/chat-panel.tsx
git commit -m "feat: hand homepage prompts to sandbox"
```

---

### Task 7: Responsive, Reduced-Motion, and Final Quality Gate

**Files:**
- Modify: `src/components/home/home-gallery.module.css`
- Modify only if validation exposes a real defect: files created or modified in Tasks 3–6.

**Interfaces:**
- Consumes: the completed homepage and Sandbox handoff.
- Produces: verified desktop, tablet, mobile, keyboard, media-failure, and reduced-motion behavior.

- [ ] **Step 1: Run the automated quality gate before visual edits**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: every command exits 0. If a command fails, fix only the directly responsible file and rerun the same command before continuing.

- [ ] **Step 2: Start the existing development server**

```bash
pnpm dev
```

Expected: Next.js reports a ready local URL without rewriting application files other than generated caches and the existing agent rules block.

- [ ] **Step 3: Inspect the homepage at three exact viewport widths**

Use the in-app Browser and capture the full page at:

- Desktop: `1440 × 1000`
- Tablet: `1024 × 900`
- Mobile: `390 × 844`

At each width verify:

- No horizontal overflow.
- Hero art remains the dominant object.
- Header controls remain readable over the dark stage and after the light transition.
- Exhibition index reflows without card-like containers.
- Field labels and lines do not overlap.
- Editorial items have visibly different weight.
- Prompt input and submit action fit without clipping.

- [ ] **Step 4: Verify media and motion states**

Exercise these four states:

1. A feed visualization with a valid `videoUrl`: video is muted, inline, looping, and pausable.
2. A feed visualization with `videoUrl: null`: SVG is visible immediately.
3. A broken video URL: `onError` replaces it with SVG without changing hero height.
4. `prefers-reduced-motion: reduce`: no autoplay and no orbit-loop animation.

If CSS changes are required, keep them inside `home-gallery.module.css`; do not edit global animation utilities.

- [ ] **Step 5: Verify keyboard and screen-reader names**

Tab through the page in DOM order and confirm visible focus on:

- Header navigation and auth controls.
- Hero primary and secondary links.
- Media play/pause control when present.
- Every mathematical field link.
- Every editorial item link.
- Prompt input and submit button.

Inspect accessible names for the SVG, media control, field links, prompt error, and section headings.

- [ ] **Step 6: Re-run all checks after visual fixes**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
git status --short
```

Expected:

- All commands exit 0.
- `renderer/start.sh` remains modified but unstaged.
- `.superpowers/` remains untracked and unstaged.
- Only intentional homepage/Sandbox files from this plan are staged or modified by implementation.

- [ ] **Step 7: Commit final polish**

If Task 7 changed files:

```bash
git add src/components/home/home-gallery.module.css src/components/home/gallery-hero.tsx src/components/home/math-field-map.tsx src/components/home/editorial-feed.tsx src/components/home/concept-prompt.tsx src/components/layout/app-header.tsx
git commit -m "fix: polish gallery homepage responsiveness"
```

If Task 7 required no changes, do not create an empty commit.

---

## Completion Criteria

- The homepage is recognizably a digital mathematics gallery, not a generic SaaS landing page.
- Real community video is preferred; missing, blocked, reduced-motion, and failed media states use the SVG fallback.
- The page transitions from a dark exhibition stage into a light editorial reading area.
- Noto Sans SC 400/500 is self-hosted through Next.js 16.3.
- The existing default AppHeader appearance and non-homepage routes remain stable.
- Explore field links use the existing `/explore?tag=...` behavior.
- Homepage community content is deterministic, asymmetric, and never duplicated to fill space.
- The homepage prompt is validated, encoded, transferred to Sandbox, prefilled once, and never auto-sent.
- Tests, typecheck, lint, production build, responsive inspection, keyboard access, and reduced motion all pass.
