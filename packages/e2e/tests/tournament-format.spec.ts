import type { Page, Route } from "@playwright/test";
import { test, expect, TEST_ADDRESS } from "./fixtures.js";

/**
 * Tournaments on chain (poker-vm#2776): format "tournament", which holds a full
 * table for its start time. The waiting modal is the only thing that sends
 * START, so it has to stay up on a full table, or the table never starts.
 * Frames are injected onto the stub's seeded table (6 seats, min 2).
 */
const STUB = "http://localhost:8546";
const SNG_GAME_ID = "0x00000000000000000000000000000000000000000000000000000000cafe0002";
const SHOTS = new URL("../../../screenshots/", import.meta.url).pathname;
/** The progress bar animates over 500ms; let it finish before a screenshot. */
const BAR_SETTLE_MS = 700;
const BOT = (seat: number) => `b521stubbot0000000000000000000000000000bot${seat}`;

type Json = Record<string, unknown>;

async function stubState(): Promise<Json> {
  const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${SNG_GAME_ID}`);
  return (await res.json()) as Json;
}

async function inject(format: string, gameState: Json): Promise<void> {
  await fetch(`${STUB}/__control/inject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: SNG_GAME_ID,
      frame: { event: "action_performed", gameId: SNG_GAME_ID, data: { format, variant: "texas-holdem", gameState } },
    }),
  });
}

const player = (address: string, seat: number): Json => ({
  address,
  seat,
  stack: "1500",
  isSmallBlind: false,
  isBigBlind: false,
  isDealer: false,
  holeCards: [],
  status: "seated",
  legalActions: [],
});

/** Taking a seat reloads the page 1.5s later, which would drop any frame injected before it. */
async function takeSeat(page: Page): Promise<void> {
  const reloaded = page.waitForEvent("load", { timeout: 20_000 });
  await page.getByRole("button", { name: "Take My Seat" }).first().click();
  await reloaded;
}

/** Whether the stub has recorded START. */
async function startRecorded(): Promise<boolean> {
  const state = (await stubState()).gameState as Json;
  return (state.previousActions as Json[]).some((a) => a.action === "start");
}

/** Refuse the page's transactions, so the ready state stays up without its auto-START landing. */
async function blockBroadcasts(page: Page): Promise<() => Promise<void>> {
  const handler = async (route: Route) => {
    if (route.request().postData()?.includes("broadcast_tx")) return route.abort();
    return route.fallback();
  };
  await page.route("http://localhost:8546/**", handler);
  return () => page.unroute("http://localhost:8546/**", handler);
}

/** Every seat taken, with us in `mySeat`. */
const fullTable = (mySeat: number): Json[] =>
  [1, 2, 3, 4, 5, 6].map((seat) => player(seat === mySeat ? TEST_ADDRESS : BOT(seat), seat));

test("a full tournament keeps its waiting modal until START, then starts", async ({ page }) => {
  await page.goto(`/table/${SNG_GAME_ID}`);
  await takeSeat(page);
  const panel = page.getByTestId("scheduled-start-panel");
  await expect(panel).toBeVisible({ timeout: 20_000 });

  const base = (await stubState()).gameState as Json;
  const options = { ...(base.gameOptions as Json), waitForStartTime: true };
  const mySeat = ((base.players as Json[]).find((p) => p.address === TEST_ADDRESS)?.seat as number) ?? 1;

  await test.step("full before the start time: still waiting, with the countdown", async () => {
    await inject("tournament", { ...base, gameOptions: { ...options, scheduledStartTime: Date.now() + 5 * 60 * 1000 }, players: fullTable(mySeat) });
    await expect(page.getByRole("heading", { name: "Table Full" })).toBeVisible({ timeout: 10_000 });
    await expect(panel).toContainText("STARTS IN");
    await expect(panel).not.toContainText("starts early");
    await expect(page.getByText("Every seat is taken.")).toBeVisible();
    await expect(page.getByText("Minimum reached, waiting for the start time")).toBeVisible();
    await expect(page.getByText("You are registered: 6 of 6 seats taken")).toBeVisible();
    await expect(page.getByText("Starts at the start time with at least the minimum")).toBeVisible();
    await page.waitForTimeout(BAR_SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}tournament-full-waiting.png` });
  });

  await test.step("under the minimum: counts up to the minimum, not to a full table", async () => {
    await inject("tournament", { ...base, gameOptions: { ...options, minPlayers: 3, scheduledStartTime: Date.now() + 5 * 60 * 1000 }, players: [player(TEST_ADDRESS, mySeat)] });
    await expect(page.getByText("Waiting for 2 more players to reach the minimum")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Waiting for Players" })).toBeVisible();
    await page.waitForTimeout(BAR_SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}tournament-under-minimum.png` });
  });

  await test.step("the start time arrives, with the chain unreachable: Start now is there as a fallback", async () => {
    const unblock = await blockBroadcasts(page);
    await inject("tournament", { ...base, gameOptions: { ...options, scheduledStartTime: Date.now() - 5_000 }, players: fullTable(mySeat) });
    await expect(panel).toContainText("READY TO START", { timeout: 10_000 });
    await expect(page.getByTestId("start-tournament-button")).toBeEnabled();
    await expect(page.getByText("The start time has arrived.")).toBeVisible();
    await expect(page.getByText("Minimum reached, ready to start")).toBeVisible();
    await page.waitForTimeout(BAR_SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}tournament-full-ready.png` });
    expect(await startRecorded()).toBe(false);
    await unblock();
  });

  await test.step("the page sends START by itself, with nobody pressing anything, and the modal leaves", async () => {
    await expect.poll(startRecorded, { timeout: 20_000 }).toBe(true);
    await expect(panel).toBeHidden({ timeout: 10_000 });
  });
});

test("a full table without the hold still leaves the waiting modal, because the engine deals it", async ({ page }) => {
  await page.goto(`/table/${SNG_GAME_ID}`);
  await takeSeat(page);
  const panel = page.getByTestId("scheduled-start-panel");
  await expect(panel).toBeVisible({ timeout: 20_000 });

  const base = (await stubState()).gameState as Json;
  const mySeat = ((base.players as Json[]).find((p) => p.address === TEST_ADDRESS)?.seat as number) ?? 1;
  await inject("sit-and-go", { ...base, players: fullTable(mySeat) });
  await expect(panel).toBeHidden({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Table Full" })).toHaveCount(0);
});

test("the join modal shows for a tournament and promises no early start", async ({ page }) => {
  await page.goto(`/table/${SNG_GAME_ID}`);
  const info = page.getByTestId("scheduled-start-info");
  await expect(info).toContainText("or earlier when full", { timeout: 15_000 }); // the seeded table has no hold

  const base = (await stubState()).gameState as Json;
  await inject("tournament", { ...base, gameOptions: { ...(base.gameOptions as Json), waitForStartTime: true }, players: [player(BOT(1), 1)] });
  await expect(info).toContainText(/Starts .* with at least 2 players$/, { timeout: 10_000 });
  await expect(page.getByRole("dialog", { name: "Tournament" }).getByText("Starts at the start time with at least the minimum")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}tournament-join.png` });
});
