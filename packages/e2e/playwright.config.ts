import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// The ui app root is two levels up from packages/e2e — that's where `yarn dev`
// and `yarn stub` (workspace scripts) must run.
const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const UI_URL = process.env.UI_URL ?? "http://localhost:5173";
const STUB_HEALTH = "http://localhost:8546/health";

/**
 * e2e: drive the real UI against the local wallet-stub. Both servers are booted
 * here (reused if you already have them running via `yarn dev` / `yarn stub`).
 * The app runs chain-direct: the "Stub" network preset (seeded into localStorage
 * by tests/fixtures.ts) points the SDK at the stub's CometBFT RPC + chain WS on
 * :8546, so no manual dropdown step and no gateway.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // one stub, shared in-memory game state — keep tests serial
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: UI_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "yarn stub",
      cwd: uiRoot,
      url: STUB_HEALTH,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "yarn dev",
      cwd: uiRoot,
      url: UI_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
