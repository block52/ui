import { test, expect } from "./fixtures.js";

/**
 * Blind structure selector on the create modal (ui#860, poker-vm#1734): a
 * Sit & Go can pick the Ladder (the default, ui#905) or Doubling (both from the
 * opening blinds + level time selects), an engine preset,
 * or a custom structure in the SDK's text form, with a live level preview.
 * Saves screenshots of the modal for the PR.
 */
const SHOTS = new URL("../../../screenshots/", import.meta.url).pathname;

test("the create modal offers blind structures with a level preview", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("seen_upcoming_sng_modal", "true"));
  await page.goto("/");
  await page.getByPlaceholder("Search by table name or ID...").fill("no-such-table");
  await page.getByRole("button", { name: "Create table" }).click();

  const modal = page.locator("div", { has: page.getByRole("heading", { name: "Create New Table" }) }).last();
  const choice = page.getByTestId("blind-structure");
  await expect(choice).toBeVisible();
  const preview = page.getByTestId("blind-preview");

  // The default is the ladder from 10/20 (ui#905): 20, 40, 60, 80, 100, 150, 200, 300…
  await expect(choice).toHaveValue("ladder");
  await expect(page.getByTestId("sng-blinds")).toBeVisible();
  await expect(page.getByTestId("sng-level-duration")).toBeVisible();
  await expect(preview.locator("tbody tr")).toHaveCount(10);
  await expect(preview.locator("tbody tr").nth(0)).toContainText("10 / 20");
  await expect(preview.locator("tbody tr").nth(5)).toContainText("75 / 150");
  await expect(preview.locator("tbody tr").nth(9)).toContainText("300 / 600");
  await preview.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await modal.screenshot({ path: `${SHOTS}blind-structure-ladder.png` });

  // Doubling keeps the same two selects and previews them doubling.
  await choice.selectOption("doubling");
  await page.getByTestId("sng-blinds").selectOption({ label: "25 / 50" });
  await expect(preview.locator("tbody tr").nth(1)).toContainText("50 / 100");
  // From a 1,000 big blind the engine rounds up to two figures (poker-vm#2738):
  // level 9 is 6,500 / 13,000, not 6,400 / 12,800.
  await preview.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await modal.screenshot({ path: `${SHOTS}blind-structure-doubling.png` });
  await expect(preview.locator("tbody tr").nth(8)).toContainText("6,500 / 13,000");
  await expect(preview.locator("tbody tr").nth(9)).toContainText("13,000 / 26,000");

  // A preset hides them and previews the engine's levels, antes included.
  await choice.selectOption("turbo");
  await expect(page.getByTestId("sng-blinds")).toHaveCount(0);
  await expect(preview.locator("tbody tr").nth(4)).toContainText("400 / 800");
  await expect(preview.locator("tbody tr").nth(4)).toContainText("80");
  await modal.screenshot({ path: `${SHOTS}blind-structure-turbo.png` });

  // Custom: the text form, validated live.
  await choice.selectOption("custom");
  const custom = page.getByTestId("blind-custom");
  await expect(custom).toBeVisible();
  await custom.fill("BLINDS mine {\n  duration: 20m\n  ante: bb\n  levels {\n    0: 100/200\n    1: 150/300\n    2: 200/400\n  }\n}");
  await expect(preview.locator("tbody tr").nth(1)).toContainText("150 / 300");
  await expect(preview.locator("tbody tr").nth(1)).toContainText("300");
  await modal.screenshot({ path: `${SHOTS}blind-structure-custom.png` });

  await custom.fill("BLINDS mine { start: 25/60 duration: 5m progression: double }");
  await expect(page.getByTestId("blind-structure-error")).toContainText("big blind = 2 × small blind");
  await expect(preview).toHaveCount(0);
  await modal.screenshot({ path: `${SHOTS}blind-structure-error.png` });
});
