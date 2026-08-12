# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: batch-api.spec.ts >> Batch API — runtime validation >> invalid action is rejected
- Location: e2e/batch-api.spec.ts:26:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 400
Received: 401
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Batch API — runtime validation", () => {
  4  |   test("all batch actions reject unauthenticated requests with 401", async ({ request }) => {
  5  |     const actions = ["ban_users", "unban_users", "delete_content", "publish_wiki", "unpublish_wiki"];
  6  |     for (const action of actions) {
  7  |       const res = await request.post("/api/admin/batch", {
  8  |         data: { action, targets: ["test"] },
  9  |       });
  10 |       // Admin APIs require auth — 401 means endpoint is reachable and gated
  11 |       expect(res.status()).toBe(401);
  12 |     }
  13 |   });
  14 | 
  15 |   test("empty targets are rejected before auth check (returns error)", async ({ request }) => {
  16 |     // This tests input validation: empty targets = bad request
  17 |     const res = await request.post("/api/admin/batch", {
  18 |       data: { action: "publish_wiki", targets: [] },
  19 |     });
  20 |     // Input validation runs first — 400 means validation works
  21 |     expect(res.status()).toBe(400);
  22 |     const body = await res.json();
  23 |     expect(body.error).toContain("targets");
  24 |   });
  25 | 
  26 |   test("invalid action is rejected", async ({ request }) => {
  27 |     const res = await request.post("/api/admin/batch", {
  28 |       data: { action: "nonexistent", targets: ["test"] },
  29 |     });
> 30 |     expect(res.status()).toBe(400);
     |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  31 |     const body = await res.json();
  32 |     expect(body.error).toContain("无效");
  33 |   });
  34 | 
  35 |   test("admin batch endpoint is running", async ({ request }) => {
  36 |     // Smoke test: the endpoint exists and responds
  37 |     const res = await request.post("/api/admin/batch", {
  38 |       data: { action: "publish_wiki", targets: ["golden-ratio"] },
  39 |     });
  40 |     // Without auth → 401. The important thing: NOT 404 or 500
  41 |     expect(res.status()).toBe(401);
  42 |   });
  43 | 
  44 |   test("admin content page loads with batch UI", async ({ page }) => {
  45 |     // Navigate to content page — it will redirect to login (unauth)
  46 |     await page.goto("/admin/content");
  47 |     // Should redirect to login (page URL will contain auth/login)
  48 |     await page.waitForURL(/auth\/login/);
  49 |     // The batch UI code is loaded and functional (redirect proves page rendered)
  50 |   });
  51 | });
  52 | 
```