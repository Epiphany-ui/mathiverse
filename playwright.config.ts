import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  webServer: {
    command: "NEXT_PUBLIC_SUPABASE_URL=your_supabase_url pnpm dev --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
  },
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
