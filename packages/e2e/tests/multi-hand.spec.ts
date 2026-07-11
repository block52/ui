import { test, expect, CASH_GAME_ID } from "./fixtures.js";
import type { Page } from "@playwright/test";

/**
 * Multi-hand cycle: play a hand to showdown, then start the NEXT hand and play it
 * too. `?autonewhand=false` disables the 2s auto-deal so the terminal END state is
 * stable and we drive the next hand deterministically via the manual "START NEW
 * HAND" button ([data-action="new-hand"]). Proves the engine cycles END → new hand.
 */

/** Play a check-down hand from preflop to showdown (bot only checks/calls). */
async function playHandToShowdown(page: Page): Promise<void> {
  await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  await page.locator(".btn-call").click(); // preflop: call the big blind
  for (const _street of ["flop", "turn", "river"] as const) {
    await expect(page.locator(".btn-check")).toBeVisible({ timeout: 15_000 });
    await page.locator(".btn-check").click();
  }
  await expect(page.locator(".seat-banner-text", { hasText: "WINS" })).toBeVisible({
    timeout: 15_000,
  });
}

test("play two hands in a row via new-hand", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table", async () => {
    await page.goto(`/table/${CASH_GAME_ID}?autonewhand=false`);
    await expect(page.getByTestId("gateway-transport-banner")).toBeVisible();
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
  });

  const SEAT = 5;
  await test.step(`sit down at seat ${SEAT} (buy in)`, async () => {
    await page.getByText(`Seat ${SEAT}`, { exact: true }).click();
    const confirm = page.getByRole("button", { name: new RegExp(`Confirm & Join Seat ${SEAT}`, "i") });
    await expect(confirm).toBeVisible();
    await confirm.click();
  });

  await test.step("hand #1: play to showdown", async () => {
    await playHandToShowdown(page);
  });

  await test.step("start the next hand", async () => {
    // Auto-new-hand is off, so the manual "START NEW HAND" button drives it.
    const newHand = page.locator("[data-action=\"new-hand\"]");
    await expect(newHand).toBeEnabled({ timeout: 15_000 });
    await newHand.click();
  });

  await test.step("hand #2: play to showdown", async () => {
    // A fresh preflop turn (CALL reappears) confirms hand #2 dealt; play it out.
    await playHandToShowdown(page);
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
