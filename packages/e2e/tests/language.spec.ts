import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Language setting (ui#959): a player picks a language from the lobby, the
 * screens switch without a reload, the choice survives a reload, and the table
 * uses it too, including the Settings panel where it can be changed again.
 */
test("picks a language in the lobby, keeps it, and the table uses it", async ({ page }) => {
  await test.step("the picker in the header switches the page straight away", async () => {
    await page.goto("/admin/tables");
    await expect(page.getByRole("link", { name: "Block Explorer" }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("language-button").first().click();
    await page.getByRole("menuitemradio", { name: "Deutsch" }).click();
    await expect(page.getByRole("link", { name: "Block-Explorer" }).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
  });

  await test.step("the choice survives a reload, and shows ticked", async () => {
    await page.reload();
    await expect(page.getByRole("link", { name: "Block-Explorer" }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("language-button").first().click();
    await expect(page.getByRole("menuitemradio", { name: "Deutsch" })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
  });

  await test.step("the table is in German, and Settings can change it again", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await page.getByRole("tab", { name: "Einstellungen" }).click({ timeout: 15_000 });
    await expect(page.getByText("Ton, wenn du dran bist")).toBeVisible();
    await page.getByTestId("language-button").first().click();
    await page.getByRole("menuitemradio", { name: "Español" }).click();
    await expect(page.getByRole("tab", { name: "Ajustes" })).toBeVisible();
  });
});
