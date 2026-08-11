import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Harness sanity — proves the whole e2e path works BEFORE any gameplay:
 * Playwright boots its browser, fixtures.ts seeds the wallet + Stub network into
 * localStorage, the UI comes up chain-direct against the stub, and the stub's
 * funded balance + seeded table render.
 */

test("funded USDC balance from the stub shows on the dashboard", async ({ page }) => {
  await page.goto("/");
  // WalletPanel renders "USDC Balance" + "$<amount>" from the stub's balance
  // endpoint (1000 USDC). Proves wallet seeding + Stub network + funding.
  await expect(page.getByText("USDC Balance")).toBeVisible();
  // The funded amount can render in more than one place (wallet panel + a
  // caught-up header), so assert at least one shows it rather than strict-matching.
  await expect(page.getByText("$1000.00").first()).toBeVisible();
});

test("seeded table page renders without crashing", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`/table/${CASH_GAME_ID}`);

  // Table shell mounted + at least one vacant seat from the seeded empty table.
  // "Click to Join" is VacantPlayer's subtitle.
  await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
