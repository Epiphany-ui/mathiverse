# Mathiverse Green Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a trustworthy zero-error project baseline before the AI Generation Studio changes begin.

**Architecture:** Keep product behavior unchanged while repairing the package-manager policy, moving TypeScript unit tests onto a path-alias-aware runner, and resolving the existing ESLint failures. Treat the untyped Supabase query layer as one explicit boundary instead of scattering suppressions through UI code.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript 5, ESLint 9, pnpm 11.20, Node 24.19, `tsx` + Node test runner.

## Global Constraints

- Work in the existing working tree and preserve every unrelated user change; do not reset, checkout, delete, or stage unrelated files.
- Before editing Next.js code, read `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` and the guide relevant to the file being changed.
- Keep the existing strict Next.js ESLint presets; do not disable React Hooks, accessibility, or Next.js correctness rules globally.
- A narrow `no-explicit-any` override is allowed only for `scripts/**`, `src/lib/db/**`, and `src/lib/wiki/ingest.ts` until generated Supabase database types exist.
- Do not change user-visible behavior except where an existing lint violation represents a real stale-closure, render, navigation, or error-handling bug.
- Completion requires `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` to exit with code 0.

---

### Task 1: Repair pnpm policy and the TypeScript test entrypoint

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Test: `src/components/home/home-data.test.ts`

**Interfaces:**
- Consumes: Node 24.19 and the current `node:test` test bodies.
- Produces: `pnpm test` discovers every `src/**/*.test.ts` file and resolves the `@/` alias through `tsx`.

- [ ] **Step 1: Reproduce both baseline failures**

Run:

```bash
pnpm test
node --test --experimental-strip-types 'src/**/*.test.ts'
```

Expected: the first command refuses the unresolved build-script policy; the second finds `home-data.test.ts` but fails to resolve `@/lib/utils`.

- [ ] **Step 2: Replace the generated pnpm policy placeholders with explicit booleans**

Set `pnpm-workspace.yaml` to:

```yaml
allowBuilds:
  esbuild: true
  sharp: true
  unrs-resolver: true
```

These are already locked transitive dependencies used by the current Next.js toolchain; no unrelated package receives build-script permission.

- [ ] **Step 3: Install the path-alias-aware test launcher**

Run:

```bash
pnpm add -D tsx
```

Expected: `package.json` and `pnpm-lock.yaml` change, and the approved esbuild packages complete their install scripts.

- [ ] **Step 4: Make the test script discover all TypeScript unit tests**

Replace the existing `test` script in `package.json` with:

```json
{
  "scripts": {
    "test": "tsx --test \"src/**/*.test.ts\""
  }
}
```

Keep every other existing script unchanged.

- [ ] **Step 5: Run the repaired test baseline**

Run:

```bash
pnpm test
```

Expected: all existing homepage tests pass, the `@/` alias resolves, and there is no `MODULE_TYPELESS_PACKAGE_JSON` warning.

- [ ] **Step 6: Commit only the toolchain repair**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml
git diff --cached --check
git commit -m "chore: restore test toolchain"
```

### Task 2: Consolidate the untyped Supabase boundary

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `src/app/api/visualizations/route.ts`
- Modify: `src/components/community/comment-list.tsx`
- Verify without behavior changes: `scripts/backfill-edges.ts`
- Verify without behavior changes: `scripts/seed-wiki.ts`
- Verify without behavior changes: `src/lib/db/interactions.ts`
- Verify without behavior changes: `src/lib/db/notifications.ts`
- Verify without behavior changes: `src/lib/db/queries.ts`
- Verify without behavior changes: `src/lib/db/wiki.ts`
- Verify without behavior changes: `src/lib/wiki/ingest.ts`

**Interfaces:**
- Consumes: the current dynamic Supabase clients, which do not yet have a generated `Database` generic.
- Produces: UI and API code contain no `any`; the temporary untyped boundary is visible in one ESLint configuration block.

- [ ] **Step 1: Capture the focused failure set**

Run:

```bash
pnpm eslint scripts src/lib/db src/lib/wiki/ingest.ts src/app/api/visualizations/route.ts src/components/community/comment-list.tsx --quiet
```

Expected: failures are `@typescript-eslint/no-explicit-any`, including the two `catch (err: any)` clauses and the tag filter callback.

- [ ] **Step 2: Add one documented ESLint boundary**

Insert this object before `globalIgnores(...)` in `eslint.config.mjs`:

```js
{
  // Supabase database types have not been generated for this repository yet.
  // Keep the escape hatch at the query/script boundary, never in UI or routes.
  files: [
    "scripts/**/*.ts",
    "src/lib/db/**/*.ts",
    "src/lib/wiki/ingest.ts",
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
},
```

Do not add inline disables to individual query functions.

- [ ] **Step 3: Type the visualization tag filter at the public API boundary**

Replace the tag callback in `src/app/api/visualizations/route.ts` with:

```ts
const cleanTags = Array.isArray(tags)
  ? tags.filter(
      (tag: unknown): tag is string =>
        typeof tag === "string" && tag.trim().length > 0,
    )
  : [];
```

- [ ] **Step 4: Narrow both comment submission exceptions**

Use this pattern for the reply and top-level comment catch clauses in `src/components/community/comment-list.tsx`:

```ts
} catch (error: unknown) {
  const message =
    error instanceof Error ? error.message : "评论发表失败，请稍后重试";
  setError(message);
}
```

The reply branch uses `setReplyError` and the copy `回复发表失败，请稍后重试`.

- [ ] **Step 5: Verify the boundary is narrow**

Run:

```bash
pnpm eslint scripts src/lib/db src/lib/wiki/ingest.ts src/app/api/visualizations/route.ts src/components/community/comment-list.tsx --quiet
```

Expected: exit 0. Then run:

```bash
rg -n "eslint-disable.*no-explicit-any|catch \([^)]*: any\)" src scripts
```

Expected: no new UI or route suppressions; existing unrelated suppressions are recorded for later cleanup but do not expand.

- [ ] **Step 6: Commit the explicit boundary**

```bash
git add eslint.config.mjs src/app/api/visualizations/route.ts src/components/community/comment-list.tsx
git diff --cached --check
git commit -m "chore: isolate untyped database boundary"
```

### Task 3: Resolve React 19 correctness lint failures

**Files:**
- Modify: `src/app/explore/explore-content.tsx`
- Modify: `src/app/sandbox/sandbox-content.tsx`
- Modify: `src/app/search/search-content.tsx`
- Modify: `src/components/layout/app-header.tsx`
- Modify: `src/components/shared/like-button.tsx`
- Modify: `src/components/wiki/mini-sandbox.tsx`
- Modify: `src/components/wiki/text-selection-tooltip.tsx`
- Modify: `src/components/wiki/wiki-body.tsx`
- Modify: `src/hooks/use-auth.ts`

**Interfaces:**
- Consumes: existing component props and user-visible behavior.
- Produces: no synchronous state writes in effect bodies, no ref reads during render, no functions referenced before declaration, and escaped JSX copy.

- [ ] **Step 1: Run automatic safe fixes, then capture the remaining errors**

Run:

```bash
pnpm lint --fix
pnpm lint --quiet
```

Expected: formatting/mechanical issues disappear; React Hooks correctness errors remain and guide the edits below.

- [ ] **Step 2: Move `fetchUnreadCount` before its effects and stabilize it**

In `src/components/layout/app-header.tsx`, define this before the auth effect:

```ts
const fetchUnreadCount = useCallback(async (userId: string) => {
  const supabase = createClient();
  if (!supabase) return;
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  setUnreadCount(count ?? 0);
}, []);
```

Add `fetchUnreadCount` to the auth effect dependencies. Do not copy the function into the effect.

- [ ] **Step 3: Keep the like request guard out of render state**

In `src/components/shared/like-button.tsx`, remove the unused `userId` state and `initDoneRef` bookkeeping, retain `inFlightRef` for immediate duplicate-click protection, and add:

```ts
const inFlightRef = useRef(false);
const [isPending, setIsPending] = useState(false);

const handleClick = useCallback(async () => {
  if (inFlightRef.current) return;
  inFlightRef.current = true;
  setIsPending(true);

  try {
    const supabase = createClient();
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href =
        `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLocalCount((current) => current + (wasLiked ? -1 : 1));
    setAnimating(true);
    if (!wasLiked) setBurst(true);
    setTimeout(() => setAnimating(false), 400);
    setTimeout(() => setBurst(false), 500);

    const result = wasLiked
      ? await removeLike(supabase, user.id, targetType, targetId)
      : await addLike(supabase, user.id, targetType, targetId);

    if (result.error) {
      setIsLiked(wasLiked);
      setLocalCount((current) => current + (wasLiked ? 1 : -1));
    }
  } finally {
    inFlightRef.current = false;
    setIsPending(false);
  }
}, [isLiked, targetId, targetType]);
```

Render `disabled={isPending}` instead of reading `inFlightRef.current` in JSX. In the initialization effect, delete `setUserId(user.id)` and `initDoneRef.current = true`; neither value participates in rendering or mutation.

- [ ] **Step 4: Remove prop-to-state effects from Search**

Initialize both values directly in `src/app/search/search-content.tsx`:

```ts
const [query, setQuery] = useState(initialQuery);
const [inputValue, setInputValue] = useState(initialQuery);
```

Delete the effect that copies `initialQuery`. When the submitted query is empty, clear results inside the submit/change handler before setting `query`; the fetching effect should return without synchronously calling `setResults`.

- [ ] **Step 5: Make unavailable-client fallbacks asynchronous callbacks**

For `src/app/explore/explore-content.tsx` and `src/hooks/use-auth.ts`, move the missing-Supabase state update into a queued callback so the effect only synchronizes with the external client:

```ts
if (!supabase) {
  queueMicrotask(() => {
    if (!cancelled) setLoading(false);
  });
  return () => {
    cancelled = true;
  };
}
```

`use-auth.ts` sets its existing `{ user: null, profile: null, loading: false }` state in the same guarded callback.

- [ ] **Step 6: Correct the temporary Sandbox initialization order**

In `src/app/sandbox/sandbox-content.tsx`, declare `useChat(...)` before the legacy local-storage effect so `sendMessage` is not referenced before declaration. Move local-storage parsing into a helper:

```ts
function readLegacySandboxPayload() {
  const code = localStorage.getItem("sandbox_code");
  const prompt = localStorage.getItem("sandbox_prompt");
  return { code, prompt };
}
```

Schedule the state handoff from the effect with `queueMicrotask`, guard it with a cancelled boolean, and preserve the existing one-time removal and auto-send semantics. This is a baseline-only correctness repair; the Studio plan later replaces the component.

- [ ] **Step 7: Reset Mini Sandbox through the close action**

Create one callback in `src/components/wiki/mini-sandbox.tsx`:

```ts
const resetAndClose = useCallback(() => {
  abortRef.current?.abort();
  setRenderStatus("idle");
  setRenderError("");
  setVideoUrl(null);
  setShowPublish(false);
  setPendingChanges(null);
  clearMessages();
  onClose();
}, [clearMessages, onClose]);
```

Use it for Escape, backdrop, and close-button actions; delete the effect that synchronously resets state when `open` becomes false. Remove imports and local functions reported as unused.

- [ ] **Step 8: Replace unescaped straight quotes in JSX copy**

In `src/components/wiki/text-selection-tooltip.tsx`, `src/components/wiki/wiki-body.tsx`, and `src/app/search/search-content.tsx`, replace user-facing straight quote pairs with Chinese corner quotes such as `「关键词」`. Do not insert HTML entities into JavaScript strings.

- [ ] **Step 9: Verify all React correctness fixes**

Run:

```bash
pnpm lint --quiet
pnpm typecheck
pnpm test
```

Expected: all commands exit 0.

- [ ] **Step 10: Commit the React baseline**

```bash
git add src/app/explore/explore-content.tsx src/app/sandbox/sandbox-content.tsx src/app/search/search-content.tsx src/components/layout/app-header.tsx src/components/shared/like-button.tsx src/components/wiki/mini-sandbox.tsx src/components/wiki/text-selection-tooltip.tsx src/components/wiki/wiki-body.tsx src/hooks/use-auth.ts
git diff --cached --check
git commit -m "fix: satisfy React correctness checks"
```

### Task 4: Prove the complete baseline is green

**Files:**
- Verify: `package.json`
- Verify: `pnpm-workspace.yaml`
- Verify: all repository TypeScript/TSX and CSS processed by the production build

**Interfaces:**
- Consumes: Tasks 1--3.
- Produces: the required prerequisite commit for the AI Generation Studio plan.

- [ ] **Step 1: Rebuild approved native/transpiler dependencies**

Run:

```bash
pnpm rebuild esbuild sharp unrs-resolver
```

Expected: exit 0; the previous Turbopack `spawning node pooled process: Permission denied` failure no longer occurs.

- [ ] **Step 2: Run the full automated gate**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command exits 0. Warnings must be reviewed; existing non-blocking warnings may remain only when they are unrelated and the build/lint exits 0.

- [ ] **Step 3: Run the existing application smoke check**

Run:

```bash
pnpm dev
```

In a second terminal, verify:

```bash
curl -I http://localhost:3000/
curl -I http://localhost:3000/sandbox
curl -I http://localhost:3000/wiki
```

Expected: each route returns a normal success or intentional auth redirect, and the development console has no compile error.

- [ ] **Step 4: Audit the final diff and worktree**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated user changes remain present and uncommitted exactly as they were.

- [ ] **Step 5: Commit any final baseline-only corrections**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml eslint.config.mjs src/app/explore/explore-content.tsx src/app/sandbox/sandbox-content.tsx src/app/search/search-content.tsx src/app/api/visualizations/route.ts src/components/community/comment-list.tsx src/components/layout/app-header.tsx src/components/shared/like-button.tsx src/components/wiki/mini-sandbox.tsx src/components/wiki/text-selection-tooltip.tsx src/components/wiki/wiki-body.tsx src/hooks/use-auth.ts
git diff --cached --check
git commit -m "chore: establish green project baseline"
```

If no corrections remain after earlier commits, skip this commit rather than creating an empty one.
