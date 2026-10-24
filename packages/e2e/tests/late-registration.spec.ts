import { test, expect, TEST_ADDRESS } from "./fixtures.js";

/**
 * Late registration for scheduled sit-and-gos (poker-vm#2731): the create
 * modal's late-registration choice, and the join modal of a tournament that has
 * started — open while the window lasts, closed after it. Uses the stub's
 * seeded scheduled sit-and-go and injected state frames; saves screenshots
 * under ui/screenshots/ for the PR description.
 */
const STUB = "http://localhost:8546";
const SNG_GAME_ID = "0x00000000000000000000000000000000000000000000000000000000cafe0002";
const SHOTS = new URL("../../../screenshots/", import.meta.url).pathname;

type Json = Record<string, unknown>;

async function stubState(): Promise<Json> {
  const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${SNG_GAME_ID}`);
  return (await res.json()) as Json;
}

async function inject(gameState: Json): Promise<void> {
  await fetch(`${STUB}/__control/inject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: SNG_GAME_ID,
      frame: { event: "action_performed", gameId: SNG_GAME_ID, data: { format: "sit-and-go", variant: "texas-holdem", gameState } },
    }),
  });
}

const active = (address: string, seat: number): Json => ({
  address, seat, stack: "1450", isSmallBlind: false, isBigBlind: false, isDealer: false, holeCards: [], status: "active", legalActions: [],
});

test("create modal: a Tournament can keep late registration open for its first blind levels", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("seen_upcoming_sng_modal", "true"));
  await page.goto("/");
  await page.getByPlaceholder("Search by table name or ID...").fill("no-such-table");
  await page.getByRole("button", { name: "Create table" }).click();
  await page.getByTestId("create-game-type").selectOption("tournament");

  const lateReg = page.getByTestId("late-registration");
  await expect(lateReg).toBeVisible();
  await expect(lateReg).toHaveValue("0"); // off by default
  await lateReg.selectOption("3");
  await expect(page.getByText(/Late entrants take an empty seat/)).toBeVisible();

  const modal = page.locator("div", { has: page.getByRole("heading", { name: "Create New Table" }) }).last();
  await page.getByTestId("tournament-start").scrollIntoViewIfNeeded();
  await modal.screenshot({ path: `${SHOTS}late-registration-create-modal.png` });
});

test("join modal: a started tournament is open to late entrants, then closed", async ({ page }) => {
  const base = (await stubState()).gameState as Json;
  const options = base.gameOptions as Json;
  const started = (sngStartTime: number): Json => ({
    ...base,
    handNumber: 4,
    previousActions: [],
    results: [],
    gameOptions: { ...options, scheduledStartTime: sngStartTime - 60_000, sngStartTime, blindLevelDuration: 10, lateRegistrationLevels: 3 },
    players: [active("b521stubbot00000000000000000000000000000bot", 2), active("b521stubbot00000000000000000000000000000bt2", 4)],
  });

  await page.goto(`/table/${SNG_GAME_ID}`);
  // Subscribed once the join modal shows the seeded (not yet started) table.
  await expect(page.getByTestId("scheduled-start-info")).toBeVisible({ timeout: 15_000 });

  await test.step("inside the window: open, with the closing time", async () => {
    await inject(started(Date.now() - 5 * 60_000));
    await expect(page.getByTestId("late-registration-open")).toContainText(/Late registration open until .*full starting stack/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Take My Seat" }).first()).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}late-registration-open.png` });
  });

  await test.step("after the window: closed, no seat", async () => {
    await inject(started(Date.now() - 2 * 60 * 60_000));
    await expect(page.getByTestId("late-registration-closed")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Take My Seat" }).first()).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}late-registration-closed.png` });
  });

  expect(TEST_ADDRESS).toBeTruthy();
});
