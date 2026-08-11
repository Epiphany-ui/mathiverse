import { expect, test, type Page, type Route } from "@playwright/test";

const NOW = "2026-08-12T00:00:00.000Z";
const PREVIEW_URL = "https://studio.test/preview.mp4";

function snapshot(id: string, prompt: string) {
  return {
    id, parentJobId: null, operation: "generate", mode: "new",
    status: "queued", phase: "queued", prompt, scenePlan: null,
    currentVersion: null, versions: [], validation: null, render: null,
    repairAttempt: 0, runToken: 1, failureReason: null,
    cancelRequested: false, durability: "session", createdAt: NOW, updatedAt: NOW,
  };
}

function version(id: string, code: string) {
  return {
    id: `version-${id}`, sequence: 1, source: "generated", code,
    validation: { valid: true, sceneName: "GeneratedScene", issues: [] },
    render: null, createdAt: NOW,
  };
}

function artifact() {
  return {
    url: PREVIEW_URL, format: "mp4", quality: "-ql",
    duration: 1, cacheHit: false, renderKey: "e2e-render",
  };
}

function sse(jobId: string, code: string, startId = 1) {
  const events = [
    { id: startId, jobId, createdAt: NOW, type: "phase.changed", data: { phase: "planning", label: "正在规划镜头" } },
    { id: startId + 1, jobId, createdAt: NOW, type: "version.created", data: { version: version(jobId, code) } },
    { id: startId + 2, jobId, createdAt: NOW, type: "render.completed", data: { artifact: artifact() } },
    { id: startId + 3, jobId, createdAt: NOW, type: "job.completed", data: { versionId: `version-${jobId}`, render: artifact() } },
  ];
  return events.map((event) => `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
}

async function showTaskPanel(page: Page) {
  const usesPanelTabs = await page.evaluate(() => innerWidth < 900);
  if (usesPanelTabs) {
    const taskTab = page.getByRole("button", { name: "任务", exact: true });
    await taskTab.evaluate((element: HTMLButtonElement) => element.click());
  }
  await expect(page.getByLabel("想看到什么？")).toBeVisible();
}

async function mockPreview(route: Route) {
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  await route.fulfill({ status: 200, contentType: "video/mp4", body: "" }).catch(() => {});
}

test("accepted job visibly works, completes, and exposes a preview", async ({ page }) => {
  const jobId = "job-complete";
  await page.route(PREVIEW_URL, mockPreview);
  await page.route("**/api/generation/jobs**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST") {
      const body = request.postDataJSON() as { prompt: string };
      return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ jobId, status: "accepted", snapshot: snapshot(jobId, body.prompt) }) });
    }
    if (url.pathname.endsWith("/events")) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-cache" }, body: sse(jobId, "from manim import *\nclass GeneratedScene(Scene):\n    pass\n") });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot(jobId, "单位圆")) });
  });

  await page.goto("/sandbox");
  await showTaskPanel(page);
  await page.getByLabel("想看到什么？").fill("绘制单位圆");
  await page.getByRole("button", { name: "开始生成" }).click();
  await expect(page.getByText("任务已进入队列")).toBeVisible();
  await expect(page.getByText("动画已完成，可以预览或发布")).toBeVisible();
  await expect(page.getByLabel("动画画布")).toHaveAttribute("data-canvas-state", "preview");
  await expect(page.getByRole("button", { name: "发布作品" })).toBeEnabled();
});

test("takeover rejects a late old-job event before a new job completes", async ({ page }) => {
  let postCount = 0;
  let releaseOld!: () => void;
  const oldGate = new Promise<void>((resolve) => { releaseOld = resolve; });
  await page.route(PREVIEW_URL, mockPreview);
  await page.route("**/api/generation/jobs**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST") {
      postCount += 1;
      const id = postCount === 1 ? "job-a" : "job-b";
      const body = request.postDataJSON() as { prompt: string };
      return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ jobId: id, status: "accepted", snapshot: snapshot(id, body.prompt) }) });
    }
    if (request.method() === "PATCH") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }
    if (url.pathname.endsWith("/job-a/events")) {
      await oldGate;
      return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse("job-a", "# OLD JOB MUST NOT WIN") }).catch(() => {});
    }
    if (url.pathname.endsWith("/job-b/events")) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse("job-b", "# NEW JOB WINS") });
    }
    const id = url.pathname.includes("job-b") ? "job-b" : "job-a";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot(id, id)) });
  });

  await page.goto("/sandbox");
  await showTaskPanel(page);
  const prompt = page.getByLabel("想看到什么？");
  await prompt.fill("任务 A");
  await page.getByRole("button", { name: "开始生成" }).click();
  await page.getByRole("button", { name: "接管编辑" }).click();

  const codeTab = page.getByRole("button", { name: "代码", exact: true });
  if (await codeTab.isVisible()) await codeTab.click();
  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await editor.pressSequentially("# MANUAL TAKEOVER");
  releaseOld();
  await expect(editor).toContainText("# MANUAL TAKEOVER");
  await expect(editor).not.toContainText("OLD JOB");

  await showTaskPanel(page);
  await prompt.fill("任务 B");
  await page.getByRole("button", { name: "开始生成" }).click();
  await expect(page.getByText("动画已完成，可以预览或发布")).toBeVisible();
  if (await codeTab.isVisible()) await codeTab.click();
  await expect(editor).toContainText("# NEW JOB WINS");
  await expect(editor).not.toContainText("OLD JOB");
});

test("keeps the exact responsive viewport, essential controls, and reduced motion", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => sessionStorage.removeItem("mathiverse:studio-presented"));
  await page.goto("/sandbox");
  const configured = testInfo.project.use.viewport;
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.width).toBe(configured?.width);
  expect(dimensions.height).toBe(configured?.height);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  const reducedMotion = await page
    .locator('[data-studio-motion-layer="shell"]')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        durationSeconds: Number.parseFloat(style.animationDuration) || 0,
        transform: style.transform,
      };
    });
  expect(reducedMotion.durationSeconds).toBeLessThanOrEqual(0.15);
  expect(reducedMotion.transform).toBe("none");
  await showTaskPanel(page);
  await expect(page.getByLabel("想看到什么？")).toBeVisible();
  await expect(page.getByRole("button", { name: "开始生成" })).toBeVisible();
  await expect(page.getByLabel("创作任务")).toBeVisible();
  await expect(page.getByLabel("工作区面板")).toBeAttached();
});
