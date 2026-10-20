import { test, expect } from "./fixtures.js";

/**
 * Lobby "Game" column (ui#824): names the game the way the table header does —
 * the betting limit spelled out when it is not no-limit. The stub seeds a
 * no-limit Hold'em cash table, a Hold'em sit-and-go and a pot-limit Omaha
 * cash table (PLO_GAME_ID). Saves a screenshot of the list for the PR.
 */
const SHOTS = new URL("../../../screenshots/", import.meta.url).pathname;

test("the lobby names a pot-limit Omaha table as such", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("seen_upcoming_sng_modal", "true"));
  await page.goto("/");
  const games = page.getByTestId("lobby-game");
  await expect(games.filter({ hasText: "Pot-Limit Omaha" })).toHaveCount(1, { timeout: 15_000 });
  await expect(games.filter({ hasText: /^Texas Hold'em$/ })).toHaveCount(2);
  await expect(page.getByText(/^Omaha$/)).toHaveCount(0);
  await page.locator("table", { has: games.first() }).screenshot({ path: `${SHOTS}lobby-game-column.png` });
});
