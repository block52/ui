import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Player notes (ui#947): click an opponent's seat, tag them and write a note,
 * press OK → the tag icons sit beside their stack pill and survive a reload.
 * Set NOTES_SHOTS=<dir> to also save screenshots for the PR.
 */

const SHOTS = process.env.NOTES_SHOTS;

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: SHOTS ? 2 : 1 });

test("tag and note an opponent; the icons show by their pill", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("sit down so the bot joins as an opponent", async () => {
    await page.goto(`/table/${CASH_GAME_ID}?autonewhand=false`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
    await page.getByText("Seat 5", { exact: true }).click();
    await page.getByRole("button", { name: /Confirm & Join Seat 5/i }).click();
  });

  const opponent = page.locator('[data-testid^="opponent-seat-"]').first();
  await expect(opponent).toBeVisible({ timeout: 15_000 });
  await expect(opponent.getByTestId("player-note-tags")).toHaveCount(0);

  await test.step("click the opponent → the notes box opens", async () => {
    await opponent.locator(".badge-container").click();
    await expect(page.getByTestId("player-notes-panel")).toBeVisible();
  });

  await test.step("pick tags and type a note", async () => {
    await page.getByTestId("player-note-tag-fish").click();
    await page.getByTestId("player-note-tag-aggressive").click();
    await expect(page.getByTestId("player-note-tag-fish")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("player-notes-text").fill("Limps then 3-bets light. Never folds top pair.");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/notes-panel.png` });
  });

  await test.step("OK → icons sit beside the pill", async () => {
    await page.getByTestId("player-notes-ok").click();
    await expect(page.getByTestId("player-notes-panel")).toHaveCount(0);
    const tags = opponent.getByTestId("player-note-tags");
    await expect(tags).toBeVisible();
    await expect(tags).toContainText("🐟");
    await expect(tags).toContainText("🔥");
    await expect(tags).toHaveAttribute("title", /Fish, Aggressive\nLimps then 3-bets light/);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/notes-table.png` });
      const box = await opponent.boundingBox();
      if (box) await page.screenshot({ path: `${SHOTS}/notes-seat.png`, clip: { x: box.x - 90, y: box.y - 10, width: box.width + 120, height: box.height + 20 } });
    }
  });

  await test.step("the note survives a reload and re-opens with what was saved", async () => {
    await page.reload();
    const seat = page.locator('[data-testid^="opponent-seat-"]').first();
    await expect(seat.getByTestId("player-note-tags")).toContainText("🐟", { timeout: 15_000 });
    await seat.locator(".badge-container").click();
    await expect(page.getByTestId("player-notes-text")).toHaveValue("Limps then 3-bets light. Never folds top pair.");
    await expect(page.getByTestId("player-note-tag-aggressive")).toHaveAttribute("aria-pressed", "true");
  });

  await test.step("Esc closes without saving; Delete note removes the icons", async () => {
    await page.getByTestId("player-note-tag-shark").click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("player-notes-panel")).toHaveCount(0);
    const seat = page.locator('[data-testid^="opponent-seat-"]').first();
    await expect(seat.getByTestId("player-note-tags")).not.toContainText("🦈");

    await seat.locator(".badge-container").click();
    await page.getByRole("button", { name: "Delete note" }).click();
    await expect(seat.getByTestId("player-note-tags")).toHaveCount(0);
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
