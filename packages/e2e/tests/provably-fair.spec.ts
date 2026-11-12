import type { Page } from "@playwright/test";
import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Provably fair verification (ui#972) against the stub, which now deals a
 * seeded new-hand exactly as the engine does (SDK Deck.shuffleFromSeed, hole
 * cards round by round in seat order, five set aside, then the board) and serves
 * the new-hand tx over REST and the hand_completed event on hand_ended.
 *
 * Hand #1 starts when the bot sits down (no new-hand, no seed), so it can't be
 * recomputed. Hand #2 starts from the UI's new-hand, which carries
 * "seed=<hex>": pending while it runs, verified once it ends. Saves screenshots
 * under ui/screenshots/ (or SHOTS_DIR) for the PR description.
 */
const SHOTS = process.env.SHOTS_DIR ?? new URL("../../../screenshots/", import.meta.url).pathname;

async function playHandToShowdown(page: Page): Promise<void> {
  await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  await page.locator(".btn-call").click();
  for (const _street of ["flop", "turn", "river"] as const) {
    await expect(page.locator(".btn-check")).toBeVisible({ timeout: 15_000 });
    await page.locator(".btn-check").click();
  }
  await expect(page.locator(".seat-banner-text", { hasText: "WINS" })).toBeVisible({ timeout: 15_000 });
}

test("verify a hand: pending while it runs, verified from its seed once it ends", async ({ page }) => {
  test.setTimeout(120_000); // two hands to showdown plus three verify windows
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`/table/${CASH_GAME_ID}?autonewhand=false`);
  await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
  await page.getByText("Seat 5", { exact: true }).click();
  await page.getByRole("button", { name: /Confirm & Join Seat 5/i }).click();

  await test.step("hand #1 (dealt at sit-down, no seed)", async () => {
    await playHandToShowdown(page);
  });

  await test.step("hand #2 starts from a new-hand carrying a seed", async () => {
    const newHand = page.locator('[data-action="new-hand"]');
    await expect(newHand).toBeEnabled({ timeout: 15_000 });
    await newHand.click();
    await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  });

  await test.step("while hand #2 runs: the panel and a pending verification", async () => {
    await page.getByTestId("provably-fair-tab").click();
    const panel = page.getByTestId("provably-fair-panel");
    await expect(panel.getByTestId("provably-fair-this-hand")).toContainText("This hand #2");
    await expect(panel.getByTestId("provably-fair-this-hand")).toContainText("opens when the hand ends");
    await panel.getByRole("button", { name: "How it works" }).click();
    await expect(panel.getByTestId("provably-fair-how")).toContainText("poker/deck/v1");
    await page.screenshot({ path: `${SHOTS}provably-fair-panel.png` });

    await panel.getByTestId("provably-fair-verify-current").click();
    const modal = page.getByTestId("verify-hand-modal");
    await expect(modal.getByTestId("verify-hand-banner")).toHaveAttribute("data-tone", "pending");
    await expect(modal.locator("[data-status='pending']")).toHaveCount(3);
    await expect(modal.getByTestId("verify-hand-cards")).toHaveCount(0); // nothing about the cards while it runs
    await page.screenshot({ path: `${SHOTS}provably-fair-pending.png` });
    await modal.getByRole("button", { name: "Close" }).click();
    await expect(modal).toHaveCount(0);
  });

  await test.step("hand #2 to showdown", async () => {
    await playHandToShowdown(page);
  });

  await test.step("verify hand #2: every shown card matches its seed", async () => {
    await page.getByTestId("provably-fair-tab").click();
    await page.getByTestId("provably-fair-verify-current").click();
    const modal = page.getByTestId("verify-hand-modal");
    await expect(modal.getByTestId("verify-hand-banner")).toHaveAttribute("data-tone", "verified", { timeout: 15_000 });
    for (const check of ["seed", "board", "shown"]) {
      await expect(modal.locator(`[data-check='${check}']`)).toHaveAttribute("data-status", "pass");
    }
    await expect(modal.getByTestId("verify-hand-cards")).toContainText("Seat 5");
    await expect(modal.getByTestId("verify-hand-cards").getByText("shown")).toHaveCount(2);
    await expect(modal.getByTestId("verify-hand-inputs")).toContainText("Seed SHA-256");
    await expect(modal.getByTestId("verify-hand-download")).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}provably-fair-verified.png` });
    await modal.getByTestId("verify-hand-cards").scrollIntoViewIfNeeded();
    await modal.getByTestId("verify-hand-inputs").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}provably-fair-inputs.png` });
    await modal.getByRole("button", { name: "Close" }).click();
  });

  await test.step("hand #1 had no seed: unavailable, not verified", async () => {
    await page.getByTestId("provably-fair-tab").click();
    // Hand #2 is the live (ended) hand; the previous one is hand #1.
    await page.getByTestId("provably-fair-verify-last").click();
    const modal = page.getByTestId("verify-hand-modal");
    await expect(modal.getByTestId("verify-hand-banner")).toContainText("can't be recomputed", { timeout: 15_000 });
    await expect(modal.locator("[data-check='seed']")).toHaveAttribute("data-status", "fail");
    await modal.getByRole("button", { name: "Close" }).click();
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
