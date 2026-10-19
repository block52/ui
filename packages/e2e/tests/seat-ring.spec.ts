import { test, expect, TEST_ADDRESS } from "./fixtures.js";

/**
 * Seat ring (ui#818): a started sit-and-go keeps drawing its empty seats, so
 * that late registration and sitting in (poker-vm#2613) need no layout change
 * later — decided 2026-10-19 over hiding them. Every seat of the table has a
 * slot, the dealer button sits on the dealer's seat, and the hero is at the
 * bottom. Drives the stub's seeded sit-and-go with an injected "started" frame.
 */
const STUB = "http://localhost:8546";
const SNG_GAME_ID = "0x00000000000000000000000000000000000000000000000000000000cafe0002";
const BOT = "b521stubbot00000000000000000000000000000bot";
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

const player = (address: string, seat: number, dealer: number): Json => ({
  address,
  seat,
  stack: "1500",
  isSmallBlind: false,
  isBigBlind: false,
  isDealer: seat === dealer,
  // Dealt in: an active hero with no hole cards trips the hole-card watchdog
  // (ui#409), which re-subscribes and pulls the stub's base state back over
  // the injected frame.
  holeCards: address === TEST_ADDRESS ? ["AS", "KD"] : ["??", "??"],
  status: "active",
  legalActions: [],
  sumOfBets: "0",
  timeout: 30,
  signature: "",
});

test("a started sit-and-go keeps its empty seats drawn", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`/table/${SNG_GAME_ID}`);
  await expect(page.getByRole("button", { name: "Take My Seat" }).first()).toBeVisible({ timeout: 15_000 });
  const base = (await stubState()).gameState as Json;
  const options = base.gameOptions as Json;

  // Hero in seat 3, one bot in seat 7, on a 9-seat table, hand 2 under way.
  const now = Date.now();
  await inject({
    ...base,
    gameOptions: { ...options, maxPlayers: 9, minPlayers: 2, scheduledStartTime: now - 60_000 },
    dealer: 3,
    smallBlindPosition: 7,
    bigBlindPosition: 3,
    handNumber: 2,
    round: "preflop",
    nextToAct: 3,
    players: [player(TEST_ADDRESS, 3, 3), player(BOT, 7, 3)],
    previousActions: [
      { playerId: BOT, seat: 7, action: "small-blind", amount: "10", round: "preflop", index: 1, timestamp: now - 2000 },
      { playerId: TEST_ADDRESS, seat: 3, action: "big-blind", amount: "20", round: "preflop", index: 2, timestamp: now - 1000 },
    ],
    actionCount: 2,
    pots: ["30"],
    totalPot: "30",
    availableSeats: [1, 2, 4, 5, 6, 8, 9],
  });

  await expect(page.getByAltText("Dealer Button")).toBeVisible({ timeout: 10_000 });
  // Seven empty seats remain on the felt (a seated hero sees them as "Vacant Seat").
  await expect(page.getByText("Vacant Seat")).toHaveCount(7, { timeout: 10_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}seat-ring-started-2of9.png` });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
