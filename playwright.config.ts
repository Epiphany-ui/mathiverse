import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  projects: [
    {
      name: "mobile-portrait",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-landscape",
      use: { browserName: "chromium", viewport: { width: 844, height: 390 } },
    },
    {
      name: "tablet-portrait",
      use: { browserName: "chromium", viewport: { width: 768, height: 1024 } },
    },
    {
      name: "tablet-landscape",
      use: { browserName: "chromium", viewport: { width: 1024, height: 768 } },
    },
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
  ],
});
