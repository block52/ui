import { test, expect } from "./fixtures.js";

/**
 * Tournament game type in the lobby's create modal (ui#823): Cash Game /
 * Sit & Go / Tournament, where Tournament carries the start time and minimum
 * players, and Sit & Go has no scheduling at all. The "Create table" button
 * only shows in the lobby's empty state, so the list is first searched down
 * to nothing. Saves a screenshot of the modal for the PR.
 */
const SHOTS = new URL("../../../screenshots/", import.meta.url).pathname;

test("the create modal offers a Tournament type that carries the start time", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("seen_upcoming_sng_modal", "true"));
  await page.goto("/");
  await page.getByPlaceholder("Search by table name or ID...").fill("no-such-table");
  await page.getByRole("button", { name: "Create table" }).click();

  const gameType = page.getByTestId("create-game-type");
  await expect(gameType).toBeVisible();
  await expect(gameType.locator("option")).toHaveText(["Sit & Go", "Cash Game", "Tournament"]);

  // A Sit & Go (the default) has no scheduling fields any more.
  await expect(gameType).toHaveValue("sit-and-go");
  await expect(page.getByTestId("tournament-start")).toHaveCount(0);

  // A Tournament always has a start time and a minimum.
  await gameType.selectOption("tournament");
  const block = page.getByTestId("tournament-start");
  await expect(block).toBeVisible();
  await expect(block.getByText("Start time", { exact: true })).toBeVisible();
  await expect(block.getByText("Minimum players", { exact: true })).toBeVisible();

  const modal = page.locator("div", { has: page.getByRole("heading", { name: "Create New Table" }) }).last();
  await modal.screenshot({ path: `${SHOTS}tournament-type-create-modal.png` });
});
