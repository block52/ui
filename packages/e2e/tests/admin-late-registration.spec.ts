import { test, expect } from "./fixtures.js";

/**
 * /admin/tables offers late registration for a Tournament (ui#881), like the
 * lobby's create modal. Saves a screenshot for the PR.
 */
const SHOTS = new URL("../../../screenshots/", import.meta.url).pathname;

test("admin tables: a Tournament can keep late registration open", async ({ page }) => {
  await page.goto("/admin/tables");
  const gameType = page.getByTestId("create-game-type");
  await expect(gameType).toBeVisible({ timeout: 15_000 });
  await gameType.selectOption("tournament");
  const lateReg = page.getByTestId("late-registration");
  await expect(lateReg).toBeVisible();
  await expect(lateReg).toHaveValue("0");
  await lateReg.selectOption("3");
  await expect(page.getByText(/Late entrants take an empty seat/)).toBeVisible();
  const block = page.getByTestId("tournament-start");
  const form = page.locator("div", { has: page.getByText("Create New Table") }).filter({ has: block }).last();
  await form.scrollIntoViewIfNeeded();
  await form.screenshot({ path: `${SHOTS}admin-late-registration.png` });
});

test("lobby create modal: one game picker (no leftover Variant select)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("seen_upcoming_sng_modal", "true"));
  await page.goto("/");
  await page.getByPlaceholder("Search by table name or ID...").fill("no-such-table");
  await page.getByRole("button", { name: "Create table" }).click();
  await page.getByTestId("create-game-type").selectOption("tournament");
  const modal = page.locator("div", { has: page.getByRole("heading", { name: "Create New Table" }) }).last();
  await expect(modal.getByText("Game", { exact: true })).toBeVisible();
  await expect(modal.getByText("Variant", { exact: true })).toHaveCount(0);
  await expect(modal.getByText(/Coming Soon/)).toHaveCount(0);
  await page.getByTestId("late-registration").selectOption("3");
  await modal.screenshot({ path: `${SHOTS}lobby-create-modal-no-variant.png` });
});
