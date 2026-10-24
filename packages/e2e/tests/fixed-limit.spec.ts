import { test, expect, CASH_GAME_ID, TEST_ADDRESS } from "./fixtures.js";

/**
 * Fixed-limit Hold'em (ui#883): the create modal offers Fixed-Limit for Hold'em
 * only, and on a fixed-limit table a bet or raise has one amount, so the action
 * panel shows no slider or presets. Saves screenshots for the PR.
 */
const STUB = "http://localhost:8546";
const SHOTS = new URL("../../../screenshots/", import.meta.url).pathname;
const HERO_SEAT = 5;

type Json = Record<string, unknown>;

test("create modal: Fixed-Limit is offered for Hold'em, not for Omaha", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("seen_upcoming_sng_modal", "true"));
  await page.goto("/");
  await page.getByPlaceholder("Search by table name or ID...").fill("no-such-table");
  await page.getByRole("button", { name: "Create table" }).click();

  const limit = page.getByTestId("create-betting-limit");
  await expect(limit.locator("option")).toHaveText(["No-Limit", "Pot-Limit", "Fixed-Limit"]);
  await limit.selectOption("fixed-limit");
  await expect(limit).toHaveValue("fixed-limit");
  const modal = page.locator("div", { has: page.getByRole("heading", { name: "Create New Table" }) }).last();
  await modal.screenshot({ path: `${SHOTS}fixed-limit-create-modal.png` });

  // Omaha has no fixed-limit; switching resets the limit to pot-limit.
  await page.getByRole("combobox").filter({ has: page.locator("option", { hasText: "Omaha" }) }).first().selectOption("omaha");
  await expect(limit.locator("option")).toHaveText(["No-Limit", "Pot-Limit"]);
  await expect(limit).toHaveValue("pot-limit");
});

test("action panel: a fixed-limit raise has one amount and no slider", async ({ page }) => {
  await page.goto(`/table/${CASH_GAME_ID}`);
  await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
  await page.getByText(`Seat ${HERO_SEAT}`, { exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`Confirm & Join Seat ${HERO_SEAT}`, "i") }).click();
  await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });

  const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${CASH_GAME_ID}`);
  const body = (await res.json()) as { format: string; variant: string; gameState: Json };
  const state = body.gameState;
  const bb = (state.gameOptions as Json).bigBlind as string;
  state.gameOptions = { ...(state.gameOptions as Json), bettingLimit: "fixed-limit" };
  state.round = "preflop";
  state.nextToAct = HERO_SEAT;
  const raiseTo = (BigInt(bb) * 2n).toString();
  state.players = (state.players as Json[]).map((p) =>
    p.address === TEST_ADDRESS
      ? {
          ...p,
          status: "active",
          legalActions: [
            { action: "fold", min: "0", max: "0", index: 9 },
            { action: "call", min: bb, max: bb, index: 9 },
            { action: "raise", min: raiseTo, max: raiseTo, index: 9 },
          ],
        }
      : p
  );
  await fetch(`${STUB}/__control/inject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: CASH_GAME_ID,
      frame: { event: "action_performed", gameId: CASH_GAME_ID, data: { format: body.format, variant: body.variant, gameState: state } },
    }),
  });

  await expect(page.getByText("Fixed-Limit Texas Hold'em").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('input[type="range"]')).toHaveCount(0);
  const raise = page.getByRole("button", { name: /raise to/i });
  await expect(raise).toBeEnabled();
  await page.screenshot({ path: `${SHOTS}fixed-limit-action-panel.png` });
});
