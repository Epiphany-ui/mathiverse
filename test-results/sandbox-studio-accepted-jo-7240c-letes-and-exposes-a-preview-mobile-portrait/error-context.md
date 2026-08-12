# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sandbox-studio.spec.ts >> accepted job visibly works, completes, and exposes a preview
- Location: e2e/sandbox-studio.spec.ts:55:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '任务', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link [ref=e6] [cursor=pointer]:
          - /url: /
        - generic [ref=e12]:
          - link [ref=e13] [cursor=pointer]:
            - /url: /auth/login
            - button [ref=e14]
          - link [ref=e15] [cursor=pointer]:
            - /url: /auth/register
            - button [ref=e16]
        - button [ref=e17]
    - main [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]:
          - heading "欢迎回来" [level=1] [ref=e21]
          - paragraph [ref=e22]: 登录你的 Mathiverse 账户
        - generic [ref=e23]:
          - generic [ref=e24]:
            - text: 邮箱
            - textbox "邮箱" [ref=e25]:
              - /placeholder: name@example.com
          - generic [ref=e26]:
            - text: 密码
            - textbox "密码" [ref=e27]:
              - /placeholder: ••••••••
          - button "登录" [ref=e28]
        - generic [ref=e29]:
          - separator [ref=e30]
          - generic [ref=e31]: 或
          - separator [ref=e32]
        - button "使用 GitHub 登录" [ref=e33]
        - paragraph [ref=e34]:
          - link "忘记密码？" [ref=e35] [cursor=pointer]:
            - /url: /auth/reset-password
        - paragraph [ref=e36]:
          - text: 还没有账户？
          - link "注册" [ref=e37] [cursor=pointer]:
            - /url: /auth/register
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | import { expect, test, type Page, type Route } from "@playwright/test";
  2   | 
  3   | const NOW = "2026-08-12T00:00:00.000Z";
  4   | const PREVIEW_URL = "https://studio.test/preview.mp4";
  5   | 
  6   | function snapshot(id: string, prompt: string) {
  7   |   return {
  8   |     id, parentJobId: null, operation: "generate", mode: "new",
  9   |     status: "queued", phase: "queued", prompt, scenePlan: null,
  10  |     currentVersion: null, versions: [], validation: null, render: null,
  11  |     repairAttempt: 0, runToken: 1, failureReason: null,
  12  |     cancelRequested: false, durability: "session", createdAt: NOW, updatedAt: NOW,
  13  |   };
  14  | }
  15  | 
  16  | function version(id: string, code: string) {
  17  |   return {
  18  |     id: `version-${id}`, sequence: 1, source: "generated", code,
  19  |     validation: { valid: true, sceneName: "GeneratedScene", issues: [] },
  20  |     render: null, createdAt: NOW,
  21  |   };
  22  | }
  23  | 
  24  | function artifact() {
  25  |   return {
  26  |     url: PREVIEW_URL, format: "mp4", quality: "-ql",
  27  |     duration: 1, cacheHit: false, renderKey: "e2e-render",
  28  |   };
  29  | }
  30  | 
  31  | function sse(jobId: string, code: string, startId = 1) {
  32  |   const events = [
  33  |     { id: startId, jobId, createdAt: NOW, type: "phase.changed", data: { phase: "planning", label: "正在规划镜头" } },
  34  |     { id: startId + 1, jobId, createdAt: NOW, type: "version.created", data: { version: version(jobId, code) } },
  35  |     { id: startId + 2, jobId, createdAt: NOW, type: "render.completed", data: { artifact: artifact() } },
  36  |     { id: startId + 3, jobId, createdAt: NOW, type: "job.completed", data: { versionId: `version-${jobId}`, render: artifact() } },
  37  |   ];
  38  |   return events.map((event) => `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
  39  | }
  40  | 
  41  | async function showTaskPanel(page: Page) {
  42  |   const usesPanelTabs = await page.evaluate(() => innerWidth < 900);
  43  |   if (usesPanelTabs) {
  44  |     const taskTab = page.getByRole("button", { name: "任务", exact: true });
> 45  |     await taskTab.evaluate((element: HTMLButtonElement) => element.click());
      |                   ^ Error: locator.evaluate: Test timeout of 30000ms exceeded.
  46  |   }
  47  |   await expect(page.getByLabel("想看到什么？")).toBeVisible();
  48  | }
  49  | 
  50  | async function mockPreview(route: Route) {
  51  |   await new Promise((resolve) => setTimeout(resolve, 2_000));
  52  |   await route.fulfill({ status: 200, contentType: "video/mp4", body: "" }).catch(() => {});
  53  | }
  54  | 
  55  | test("accepted job visibly works, completes, and exposes a preview", async ({ page }) => {
  56  |   const jobId = "job-complete";
  57  |   await page.route(PREVIEW_URL, mockPreview);
  58  |   await page.route("**/api/generation/jobs**", async (route) => {
  59  |     const request = route.request();
  60  |     const url = new URL(request.url());
  61  |     if (request.method() === "POST") {
  62  |       const body = request.postDataJSON() as { prompt: string };
  63  |       return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ jobId, status: "accepted", snapshot: snapshot(jobId, body.prompt) }) });
  64  |     }
  65  |     if (url.pathname.endsWith("/events")) {
  66  |       await new Promise((resolve) => setTimeout(resolve, 350));
  67  |       return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-cache" }, body: sse(jobId, "from manim import *\nclass GeneratedScene(Scene):\n    pass\n") });
  68  |     }
  69  |     return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot(jobId, "单位圆")) });
  70  |   });
  71  | 
  72  |   await page.goto("/sandbox");
  73  |   await showTaskPanel(page);
  74  |   await page.getByLabel("想看到什么？").fill("绘制单位圆");
  75  |   await page.getByRole("button", { name: "开始生成" }).click();
  76  |   await expect(page.getByText("任务已进入队列")).toBeVisible();
  77  |   await expect(page.getByText("动画已完成，可以预览或发布")).toBeVisible();
  78  |   await expect(page.getByLabel("动画画布")).toHaveAttribute("data-canvas-state", "preview");
  79  |   await expect(page.getByRole("button", { name: "发布作品" })).toBeEnabled();
  80  | });
  81  | 
  82  | test("takeover rejects a late old-job event before a new job completes", async ({ page }) => {
  83  |   let postCount = 0;
  84  |   let releaseOld!: () => void;
  85  |   const oldGate = new Promise<void>((resolve) => { releaseOld = resolve; });
  86  |   await page.route(PREVIEW_URL, mockPreview);
  87  |   await page.route("**/api/generation/jobs**", async (route) => {
  88  |     const request = route.request();
  89  |     const url = new URL(request.url());
  90  |     if (request.method() === "POST") {
  91  |       postCount += 1;
  92  |       const id = postCount === 1 ? "job-a" : "job-b";
  93  |       const body = request.postDataJSON() as { prompt: string };
  94  |       return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ jobId: id, status: "accepted", snapshot: snapshot(id, body.prompt) }) });
  95  |     }
  96  |     if (request.method() === "PATCH") {
  97  |       return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  98  |     }
  99  |     if (url.pathname.endsWith("/job-a/events")) {
  100 |       await oldGate;
  101 |       return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse("job-a", "# OLD JOB MUST NOT WIN") }).catch(() => {});
  102 |     }
  103 |     if (url.pathname.endsWith("/job-b/events")) {
  104 |       await new Promise((resolve) => setTimeout(resolve, 100));
  105 |       return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse("job-b", "# NEW JOB WINS") });
  106 |     }
  107 |     const id = url.pathname.includes("job-b") ? "job-b" : "job-a";
  108 |     return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot(id, id)) });
  109 |   });
  110 | 
  111 |   await page.goto("/sandbox");
  112 |   await showTaskPanel(page);
  113 |   const prompt = page.getByLabel("想看到什么？");
  114 |   await prompt.fill("任务 A");
  115 |   await page.getByRole("button", { name: "开始生成" }).click();
  116 |   await page.getByRole("button", { name: "接管编辑" }).click();
  117 | 
  118 |   const codeTab = page.getByRole("button", { name: "代码", exact: true });
  119 |   if (await codeTab.isVisible()) await codeTab.click();
  120 |   const editor = page.locator(".cm-content");
  121 |   await editor.click();
  122 |   await editor.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  123 |   await editor.pressSequentially("# MANUAL TAKEOVER");
  124 |   releaseOld();
  125 |   await expect(editor).toContainText("# MANUAL TAKEOVER");
  126 |   await expect(editor).not.toContainText("OLD JOB");
  127 | 
  128 |   await showTaskPanel(page);
  129 |   await prompt.fill("任务 B");
  130 |   await page.getByRole("button", { name: "开始生成" }).click();
  131 |   await expect(page.getByText("动画已完成，可以预览或发布")).toBeVisible();
  132 |   if (await codeTab.isVisible()) await codeTab.click();
  133 |   await expect(editor).toContainText("# NEW JOB WINS");
  134 |   await expect(editor).not.toContainText("OLD JOB");
  135 | });
  136 | 
  137 | test("keeps the exact responsive viewport, essential controls, and reduced motion", async ({ page }, testInfo) => {
  138 |   await page.emulateMedia({ reducedMotion: "reduce" });
  139 |   await page.addInitScript(() => sessionStorage.removeItem("mathiverse:studio-presented"));
  140 |   await page.goto("/sandbox");
  141 |   const configured = testInfo.project.use.viewport;
  142 |   const dimensions = await page.evaluate(() => ({
  143 |     width: innerWidth,
  144 |     height: innerHeight,
  145 |     scrollWidth: document.documentElement.scrollWidth,
```