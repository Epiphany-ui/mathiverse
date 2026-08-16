# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sandbox-studio.spec.ts >> takeover rejects a late old-job event before a new job completes
- Location: e2e/sandbox-studio.spec.ts:82:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '开始生成' })
    - locator resolved to <button type="submit" class="primaryAction">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
      - waiting 100ms
    - waiting for element to be visible, enabled and stable
    - element is not stable
  53 × retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is not enabled
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "Mathiverse" [ref=e6] [cursor=pointer]:
          - /url: /
        - navigation [ref=e12]:
          - link [ref=e13] [cursor=pointer]:
            - /url: /explore
            - button "发现" [ref=e14]
          - link [ref=e15] [cursor=pointer]:
            - /url: /wiki
            - button "百科" [ref=e16]
          - link [ref=e17] [cursor=pointer]:
            - /url: /sandbox
            - button "创作" [ref=e18]
        - button [ref=e20]
        - button "切换主题" [ref=e21]
        - generic [ref=e22]:
          - link [ref=e23] [cursor=pointer]:
            - /url: /auth/login
            - button "登录" [ref=e24]
          - link [ref=e26] [cursor=pointer]:
            - /url: /auth/register
            - button "注册" [ref=e27]
    - main [ref=e30]:
      - region "创作任务" [ref=e31]:
        - text: PROOF / 01
        - heading "构造你的数学场景" [level=1] [ref=e32]
        - paragraph [ref=e33]: 任务已进入队列
        - generic [ref=e34]:
          - generic [ref=e35]: 想看到什么？
          - textbox "想看到什么？" [active] [ref=e36]:
            - /placeholder: 例如：让单位圆展开成正弦曲线，并标注角度关系
            - text: job-a
          - button "开始生成" [disabled] [ref=e37]
        - list "生成阶段" [ref=e41]:
          - listitem [ref=e42]:
            - generic [ref=e43]: "01"
            - text: 镜头规划
          - listitem [ref=e44]:
            - generic [ref=e45]: "02"
            - text: 数学检索
          - listitem [ref=e46]:
            - generic [ref=e47]: "03"
            - text: 场景生成
          - listitem [ref=e48]:
            - generic [ref=e49]: "04"
            - text: 安全验证
          - listitem [ref=e50]:
            - generic [ref=e51]: "05"
            - text: 动画渲染
        - generic [ref=e52]:
          - button "停止" [ref=e53]
          - button "接管编辑" [ref=e57]
          - button "发布作品" [disabled] [ref=e61]
      - generic [ref=e62]:
        - region "动画画布" [ref=e63]:
          - generic [ref=e64]:
            - generic [ref=e65]: CANVAS / 02
            - generic [ref=e66]: 实时预览
          - generic [ref=e68]:
            - strong [ref=e71]: 证明正在展开
            - paragraph [ref=e72]: 可以离开页面；任务会在后台继续，回来后自动恢复。
        - list "代码版本" [ref=e73]:
          - generic [ref=e74]: 尚无版本
      - region "Manim 代码" [ref=e75]:
        - generic [ref=e76]:
          - generic [ref=e77]: CODE / 03
          - generic [ref=e78]: scene.py
          - button "保存版本" [ref=e79]
        - generic [ref=e84]:
          - generic [ref=e86]:
            - generic [ref=e87]: "1"
            - generic [ref=e88]: "2"
            - generic [ref=e89]: "3"
            - generic [ref=e90]: "4"
            - generic [ref=e91]: "5"
            - generic [ref=e92]: "6"
            - generic [ref=e93]: "7"
            - generic [ref=e94]: "8"
            - generic [ref=e95]: "9"
          - textbox [ref=e96]:
            - generic [ref=e97]: from manim import *
            - generic [ref=e99]: "class FirstScene(Scene):"
            - generic [ref=e100]: "def construct(self):"
            - generic [ref=e101]: "# 描述一个数学想法，生成的 Manim 场景会出现在这里"
            - generic [ref=e102]: circle = Circle(radius=1, color=TEAL)
            - generic [ref=e103]: self.play(Create(circle))
            - generic [ref=e104]: self.wait(1)
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e111] [cursor=pointer]
  - alert [ref=e115]
```

# Test source

```ts
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
  45  |     await taskTab.evaluate((element: HTMLButtonElement) => element.click());
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
> 115 |   await page.getByRole("button", { name: "开始生成" }).click();
      |                                                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  146 |   }));
  147 |   expect(dimensions.width).toBe(configured?.width);
  148 |   expect(dimensions.height).toBe(configured?.height);
  149 |   expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  150 |   const reducedMotion = await page
  151 |     .locator('[data-studio-motion-layer="shell"]')
  152 |     .evaluate((element) => {
  153 |       const style = getComputedStyle(element);
  154 |       return {
  155 |         durationSeconds: Number.parseFloat(style.animationDuration) || 0,
  156 |         transform: style.transform,
  157 |       };
  158 |     });
  159 |   expect(reducedMotion.durationSeconds).toBeLessThanOrEqual(0.15);
  160 |   expect(reducedMotion.transform).toBe("none");
  161 |   await showTaskPanel(page);
  162 |   await expect(page.getByLabel("想看到什么？")).toBeVisible();
  163 |   await expect(page.getByRole("button", { name: "开始生成" })).toBeVisible();
  164 |   await expect(page.getByLabel("创作任务")).toBeVisible();
  165 |   await expect(page.getByLabel("工作区面板")).toBeAttached();
  166 | });
  167 | 
```