import { test, expect, TEST_ADDRESS } from "./fixtures.js";

/**
 * Scheduled single-table tournaments (poker-vm#2680) — the UI states, against
 * the stub's seeded scheduled sit-and-go (SNG_GAME_ID: 6 seats, min 2, start
 * 10 min after reset). Each step also saves a screenshot under ui/screenshots/
 * for the PR description.
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

const player = (address: string, seat: number, legalActions: Json[] = []): Json => ({
  address,
  seat,
  stack: "1500",
  isSmallBlind: false,
  isBigBlind: false,
  isDealer: false,
  holeCards: [],
  status: "seated",
  legalActions,
});

test("lobby: a scheduled sit-and-go is a Tournament with its start time and minimum; the create form offers the Tournament type", async ({ page }) => {
  // The dashboard opens its "Upcoming Sit & Go Tournaments" promo on load and
  // it covers the list; it honours the "seen" flag, so set it before loading.
  await page.addInitScript(() => localStorage.setItem("seen_upcoming_sng_modal", "true"));
  await page.goto("/");
  const label = page.getByTestId("scheduled-start-label").first();
  await expect(label).toBeVisible({ timeout: 15_000 });
  await expect(label).toContainText(/Starts .* · min 2/);
  // The lobby calls a scheduled sit-and-go a Tournament (ui#823).
  await expect(page.locator("tr", { has: label }).getByTestId("lobby-format")).toHaveText("Tournament");
  await page.locator("table", { has: label }).screenshot({ path: `${SHOTS}scheduled-sng-lobby-row.png` });

  // Tables are created on /admin/tables; the Tournament type carries the start time (ui#823).
  await page.goto("/admin/tables");
  const gameType = page.getByTestId("create-game-type");
  await expect(gameType).toBeVisible({ timeout: 15_000 });
  await expect(gameType.locator("option")).toHaveText(["Sit & Go", "Cash Game", "Tournament"]);
  await gameType.selectOption("sit-and-go");
  await expect(page.getByTestId("tournament-start")).toHaveCount(0); // a Sit & Go has no start time
  await gameType.selectOption("tournament");
  const block = page.getByTestId("tournament-start");
  await expect(block).toBeVisible();
  await expect(page.getByText("Minimum players")).toBeVisible();
  // The whole "Create New Table" form, tournament block included.
  const form = page.locator("div", { has: page.getByText("Create New Table") }).filter({ has: block }).last();
  await form.scrollIntoViewIfNeeded();
  await form.screenshot({ path: `${SHOTS}scheduled-sng-create-form.png` });
});

test("table: register → countdown → ready → START → cancelled", async ({ page }) => {
  await page.goto(`/table/${SNG_GAME_ID}`);

  await test.step("registering: the join modal says when it starts", async () => {
    await expect(page.getByTestId("scheduled-start-info")).toContainText(/Starts .* with at least 2 players/, { timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}scheduled-sng-register.png` });
  });

  await test.step("take a seat: the stub registers us without dealing", async () => {
    await page.getByRole("button", { name: "Take My Seat" }).first().click();
    const panel = page.getByTestId("scheduled-start-panel");
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel).toContainText("STARTS IN");
    await page.screenshot({ path: `${SHOTS}scheduled-sng-waiting-countdown.png` });
  });

  const base = (await stubState()).gameState as Json;
  const options = base.gameOptions as Json;
  const botSeat = ((base.players as Json[]).find((p) => p.address !== TEST_ADDRESS)?.seat as number) ?? 3;
  const mySeat = ((base.players as Json[]).find((p) => p.address === TEST_ADDRESS)?.seat as number) ?? 1;

  await test.step("ready: the start time has passed with enough players", async () => {
    await inject({
      ...base,
      gameOptions: { ...options, scheduledStartTime: Date.now() - 5_000 },
      players: [player("b521stubbot00000000000000000000000000000bot", botSeat), player(TEST_ADDRESS, mySeat)],
    });
    const panel = page.getByTestId("scheduled-start-panel");
    await expect(panel).toContainText("READY TO START", { timeout: 10_000 });
    // Enabled on the start time + minimum alone (ui#830): the stored legal
    // actions date from the last transaction and never carry START while
    // everyone waits, so the button must not depend on them.
    await expect(page.getByTestId("start-tournament-button")).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}scheduled-sng-ready.png` });
  });

  await test.step("any registered player presses Start now: START is sent and the field starts", async () => {
    await page.getByTestId("start-tournament-button").click();
    // The waiting modal leaves once the stub records START and deals everyone in.
    await expect(page.getByTestId("scheduled-start-panel")).toBeHidden({ timeout: 20_000 });
    const after = (await stubState()).gameState as Json;
    expect((after.previousActions as Json[]).some((a) => a.action === "start")).toBe(true);
    expect((after.players as Json[]).every((p) => p.status === "active")).toBe(true);
    await page.screenshot({ path: `${SHOTS}scheduled-sng-started.png` });
  });

  await test.step("cancelled: the grace window passed with too few players", async () => {
    await inject({
      ...base,
      handNumber: 1,
      previousActions: [],
      gameOptions: { ...options, scheduledStartTime: Date.now() - 20 * 60 * 1000, minPlayers: 4 },
      players: [player("b521stubbot00000000000000000000000000000bot", botSeat), player(TEST_ADDRESS, mySeat)],
    });
    await expect(page.getByText("Tournament Cancelled")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${SHOTS}scheduled-sng-cancelled.png` });
  });

  await test.step("cancelled, not seated: the join modal refuses a seat", async () => {
    await inject({
      ...base,
      handNumber: 1,
      previousActions: [],
      gameOptions: { ...options, scheduledStartTime: Date.now() - 20 * 60 * 1000, minPlayers: 4 },
      players: [player("b521stubbot00000000000000000000000000000bot", botSeat)],
    });
    await expect(page.getByTestId("scheduled-cancelled")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Take My Seat" }).first()).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}scheduled-sng-cancelled-join.png` });
  });
});
