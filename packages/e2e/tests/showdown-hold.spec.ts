import { test, expect, CASH_GAME_ID } from "./fixtures.js";
import type { Page } from "@playwright/test";

/**
 * Showdown-hold pacing (WS Action Bus, Phase 3 / plan §5.5).
 *
 * With auto-new-hand ON (the paced path), a hand's WINS banner must stay visible
 * for the showdown-hold window before the next hand replaces it. We measure the
 * wall-clock between the banner appearing and it disappearing (the next hand
 * committing) and assert a LOWER BOUND only so the test stays unflaky despite
 * scheduler jitter. The showdown hold is 2000ms; we bound at 1000ms to leave
 * ample margin for banner-detection latency on a loaded CI runner (the
 * toBeVisible poll can resolve ~1s after the banner truly appears) while still
 * proving a real hold (the 150ms frame cadence would otherwise replace it near
 * instantly). This is the regression proof that pacing keeps the showdown
 * visible after the useAutoNewHand timer was retired.
 */

const LOWER_BOUND_MS = 1_000;

async function playToShowdown(page: Page): Promise<void> {
  await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  await page.locator(".btn-call").click(); // preflop: call the big blind
  for (const _street of ["flop", "turn", "river"] as const) {
    await expect(page.locator(".btn-check")).toBeVisible({ timeout: 15_000 });
    await page.locator(".btn-check").click();
  }
}

test("the WINS banner stays visible for the showdown hold before the next hand", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table (auto-new-hand ON) and sit down", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
    await page.getByText("Seat 5", { exact: true }).click();
    const confirm = page.getByRole("button", { name: /Confirm & Join Seat 5/i });
    await expect(confirm).toBeVisible();
    await confirm.click();
  });

  await test.step("play the hand to showdown", async () => {
    await playToShowdown(page);
  });

  const banner = page.locator(".seat-banner-text", { hasText: "WINS" });

  await test.step("banner appears, then persists through the hold before the next hand", async () => {
    await expect(banner).toBeVisible({ timeout: 15_000 });
    const bannerVisibleAt = Date.now();

    // Auto-new-hand + showdownHold hold the banner, then hand #2 commits and the
    // winner banner clears. Measure the visible duration.
    await expect(banner).toBeHidden({ timeout: 15_000 });
    const bannerGoneAt = Date.now();

    const heldForMs = bannerGoneAt - bannerVisibleAt;
    expect(heldForMs, `showdown banner was only visible ${heldForMs}ms`).toBeGreaterThanOrEqual(LOWER_BOUND_MS);
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
