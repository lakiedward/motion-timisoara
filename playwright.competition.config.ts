import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3023";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/competition.simulation.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "test-results/competition",
  timeout: 60_000,
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "npm run build && npm run preview -- --port 3023 --strictPort --host 127.0.0.1",
    cwd: "motiontimisoaraApp",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:54329",
      VITE_SUPABASE_ANON_KEY: "local-simulation-only",
      VITE_STRIPE_PUBLISHABLE_KEY: "",
      VITE_CARTO_BASEMAP_API_KEY: "local-simulation-only",
    },
  },
});
