import { expect, test } from "@playwright/test";

const EXPECTED_VIEWPORTS = {
  "mobile-portrait": { width: 390, height: 844 },
  "mobile-landscape": { width: 844, height: 390 },
  "tablet-portrait": { width: 768, height: 1024 },
  "tablet-landscape": { width: 1024, height: 768 },
  desktop: { width: 1440, height: 900 },
} as const;

test("uses the exact project viewport without a browser minimum-width artifact", async ({ page }, testInfo) => {
  const viewport = EXPECTED_VIEWPORTS[testInfo.project.name as keyof typeof EXPECTED_VIEWPORTS];

  expect(viewport, `unexpected Playwright project: ${testInfo.project.name}`).toBeDefined();

  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          html, body { margin: 0; min-width: 0; }
          #viewport-probe { width: 100vw; height: 100vh; }
        </style>
      </head>
      <body><main id="viewport-probe"></main></body>
    </html>
  `);

  const dimensions = await page.evaluate(() => {
    const probe = document.querySelector<HTMLElement>("#viewport-probe");
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      probeWidth: probe?.getBoundingClientRect().width,
      probeHeight: probe?.getBoundingClientRect().height,
    };
  });

  expect(dimensions).toEqual({
    innerWidth: viewport.width,
    innerHeight: viewport.height,
    clientWidth: viewport.width,
    scrollWidth: viewport.width,
    probeWidth: viewport.width,
    probeHeight: viewport.height,
  });

  if (testInfo.project.name === "mobile-portrait") {
    expect(dimensions.innerWidth).toBe(390);
    expect(dimensions.innerHeight).toBe(844);
    expect(dimensions.innerWidth).not.toBe(492);
  }
});

test("supports reduced-motion media emulation", async ({ page }) => {
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.emulateMedia({ reducedMotion: "reduce" });

  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(false);
});
