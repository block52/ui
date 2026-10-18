import { test, expect, TEST_ADDRESS } from "./fixtures.js";

/**
 * Compact seat ring (ui#818): once a sit-and-go has started its roster is
 * frozen, so the empty seats are dropped and the players are spread evenly
 * around the table. Drives the stub's seeded sit-and-go with injected
 * "started" frames at several field sizes and saves a screenshot of each.
 *
 * Env: SHOTS_DIR (absolute, default ui/screenshots/), SHOT_PREFIX (default
 * "after"), EXPECT_COMPACT=false to only take the pictures (the "before" run
 * against main, where the empty seats are still drawn).
 */
const STUB = "http://localhost:8546";
const SNG_GAME_ID = "0x00000000000000000000000000000000000000000000000000000000cafe0002";
const BOT = (n: number) => `b521stubbot0000000000000000000000000000${String(n).padStart(3, "0")}`;
const SHOTS = process.env.SHOTS_DIR ?? new URL("../../../screenshots/", import.meta.url).pathname;
const PREFIX = process.env.SHOT_PREFIX ?? "after";
const EXPECT_COMPACT = process.env.EXPECT_COMPACT !== "false";

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

/** A started 9-seat sit-and-go with the hero in `heroSeat` and bots in `botSeats`. */
const started = (base: Json, heroSeat: number, botSeats: number[]): Json => {
  const options = base.gameOptions as Json;
  const seats = [heroSeat, ...botSeats].sort((a, b) => a - b);
  const dealer = seats[0];
  const now = Date.now();
  const occupied = new Set(seats);
  return {
    ...base,
    gameOptions: { ...options, maxPlayers: 9, minPlayers: 2, scheduledStartTime: now - 60_000 },
    dealer,
    smallBlindPosition: seats[1 % seats.length],
    bigBlindPosition: seats[2 % seats.length],
    handNumber: 2,
    round: "preflop",
    nextToAct: heroSeat,
    players: [player(TEST_ADDRESS, heroSeat, dealer), ...botSeats.map((s, i) => player(BOT(i + 1), s, dealer))],
    previousActions: [
      { playerId: BOT(1), seat: seats[1 % seats.length], action: "small-blind", amount: "10", round: "preflop", index: 1, timestamp: now - 2000 },
      { playerId: BOT(2), seat: seats[2 % seats.length], action: "big-blind", amount: "20", round: "preflop", index: 2, timestamp: now - 1000 },
    ],
    actionCount: 2,
    pots: ["30"],
    totalPot: "30",
    availableSeats: [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((s) => !occupied.has(s)),
  };
};

test("a started sit-and-go draws only the seated players, spread around the table", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`/table/${SNG_GAME_ID}`);
  await expect(page.getByRole("button", { name: "Take My Seat" }).first()).toBeVisible({ timeout: 15_000 });
  const base = (await stubState()).gameState as Json;

  const fields: Array<{ name: string; hero: number; bots: number[] }> = [
    { name: "2of9", hero: 3, bots: [7] },
    { name: "3of9", hero: 3, bots: [6, 9] },
    { name: "5of9", hero: 1, bots: [2, 5, 7, 9] },
  ];

  for (const field of fields) {
    await test.step(`${field.bots.length + 1} players seated at a 9-seat table`, async () => {
      await inject(started(base, field.hero, field.bots));
      await expect(page.getByAltText("Dealer Button")).toBeVisible({ timeout: 10_000 });
      if (EXPECT_COMPACT) {
        // No empty seat is drawn (a seated hero sees empty seats as "Vacant Seat").
        await expect(page.getByText("Vacant Seat")).toHaveCount(0);
      } else {
        await expect(page.getByText("Vacant Seat").first()).toBeVisible({ timeout: 10_000 });
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}compact-seats-${PREFIX}-${field.name}.png` });
    });
  }

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
