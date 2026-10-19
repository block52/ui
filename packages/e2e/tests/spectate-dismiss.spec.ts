import { test, expect } from "./fixtures.js";

/**
 * Dismissible Sit & Go auto-join modal (ui#837) — a player who is late to the
 * tournament or short on funds must be able to close the modal and WATCH the
 * table instead of being stuck behind the overlay. Each step saves a
 * screenshot under ui/screenshots/ for the PR description.
 */
const SNG_GAME_ID = "0x00000000000000000000000000000000000000000000000000000000cafe0002";
const SHOTS = new URL("../../../screenshots/", import.meta.url).pathname;

test("auto-join modal: dismiss to spectate, reopen to join", async ({ page }) => {
  await page.goto(`/table/${SNG_GAME_ID}`);

  await test.step("the modal opens over the table with a spectate exit", async () => {
    const modal = page.getByTestId("sng-autojoin-modal");
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("sng-autojoin-close-btn")).toBeVisible();
    await expect(page.getByTestId("sng-autojoin-spectate-btn")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}sng-autojoin-dismissible.png` });
  });

  await test.step("Watch as Spectator clears the overlay and leaves a reopen pill", async () => {
    await page.getByTestId("sng-autojoin-spectate-btn").click();
    await expect(page.getByTestId("sng-autojoin-modal")).toBeHidden();
    await expect(page.getByTestId("sng-autojoin-reopen-btn")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}sng-autojoin-spectating.png` });
  });

  await test.step("the reopen pill brings the join modal back", async () => {
    await page.getByTestId("sng-autojoin-reopen-btn").click();
    await expect(page.getByTestId("sng-autojoin-modal")).toBeVisible();
    await expect(page.getByTestId("sng-autojoin-reopen-btn")).toBeHidden();
  });

  await test.step("Escape also dismisses the modal", async () => {
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sng-autojoin-modal")).toBeHidden();
    await expect(page.getByTestId("sng-autojoin-reopen-btn")).toBeVisible();
  });
});
