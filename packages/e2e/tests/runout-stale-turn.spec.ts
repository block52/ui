import { test, expect, CASH_GAME_ID, TEST_ADDRESS } from "./fixtures.js";

/**
 * ui#968 — the next-to-act flash must not stay on a player whose fold closed a
 * called all-in.
 *
 * Production fingerprint (Texas HODL SNG 0xaafb…e1db, hands 10 and 12): a
 * player goes all-in, is called all-in-for-less, and the LAST player to act
 * folds. That fold closes the betting, so the engine deals the whole runout and
 * ends the hand inside ONE snapshot — fold, turn, river, winners together.
 * expandFrames splits that snapshot into per-street sub-frames for pacing
 * (ui#873), and each sub-frame used to inherit `prev.nextToAct` — the folder's
 * seat — so usePlayerTimer kept the turn flash and countdown on a player whose
 * fold was already committed on chain, for the whole runout choreography.
 *
 * The invariant proved here: every rendered-track commit that carries the
 * hand-closing fold (same `actionCount` as the terminal frame) must also carry
 * the terminal frame's cleared turn pointer. Asserted numerically via the
 * bus introspection (`window.__B52_BUS__.commitLog`), per the bus testing
 * conventions, rather than by racing DOM polls against the paced drain.
 */

const STUB = "http://localhost:8546";
const HERO_SEAT = 5;

/** Hand 10's board from the production game, for fidelity. */
const FLOP = ["TH", "2C", "AD"];
const FULL_BOARD = ["TH", "2C", "AD", "QD", "AH"];
const NOBODY = -1;

type PlayerLike = {
    address: string;
    seat: number;
    holeCards?: string[];
    status?: string;
    lastAction?: unknown;
    legalActions?: unknown[];
    [key: string]: unknown;
};
type ActionLike = { playerId: string; seat: number; action: string; amount: string; round: string; index: number; timestamp: number };
type StateLike = {
    players: PlayerLike[];
    communityCards: string[];
    winners: unknown[];
    round: string;
    nextToAct: number;
    legalActions: unknown[];
    previousActions: ActionLike[];
    actionCount: number;
    handNumber: number;
    [key: string]: unknown;
};
type GameStateResponse = { gameId: string; format: string; variant: string; gameState: StateLike };

type CommitEntry = { seq: number; committedAt: number; eventCount: number; nextToAct?: number; actionCount?: number };

async function fetchState(): Promise<GameStateResponse> {
    const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${CASH_GAME_ID}`);
    return (await res.json()) as GameStateResponse;
}

async function inject(body: GameStateResponse, state: StateLike): Promise<void> {
    await fetch(`${STUB}/__control/inject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            gameId: CASH_GAME_ID,
            frame: { event: "action_performed", gameId: CASH_GAME_ID, data: { format: body.format, variant: body.variant, gameState: state } }
        })
    });
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

test("a fold that closes a called all-in never leaves the turn flash on the folder", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await test.step("open the seeded table and sit down", async () => {
        await page.goto(`/table/${CASH_GAME_ID}`);
        await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
        await page.getByText(`Seat ${HERO_SEAT}`, { exact: true }).click();
        const confirm = page.getByRole("button", { name: new RegExp(`Confirm & Join Seat ${HERO_SEAT}`, "i") });
        await expect(confirm).toBeVisible();
        await confirm.click();
        await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
    });

    // Build both frames from the live organic state so every DTO field the UI
    // requires is present (Commandment 7: nothing is defaulted on the way in).
    const body = await fetchState();
    const organic = body.gameState;

    const hero = organic.players.find((p) => p.address === TEST_ADDRESS);
    const bot = organic.players.find((p) => p.address !== TEST_ADDRESS);
    expect(hero, "hero must be seated").toBeDefined();
    expect(bot, "stub bot must be seated").toBeDefined();

    const usedSeats = new Set(organic.players.map((p) => p.seat));
    const folderSeat = [1, 2, 3, 4, 6, 7, 8, 9].find((s) => !usedSeats.has(s))!;
    const folderAddress = "b521qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq968";

    // ---- prev: 3-way flop — hero all-in, bot all-in for less, folder to act ----
    const prev = clone(organic);
    prev.round = "flop";
    prev.communityCards = [...FLOP];
    prev.nextToAct = folderSeat;
    prev.legalActions = [];
    prev.winners = [];
    const prevHero = prev.players.find((p) => p.address === TEST_ADDRESS)!;
    prevHero.status = "all-in";
    prevHero.holeCards = ["AS", "QH"]; // real cards: an empty hero hand trips the hole-card watchdog (ui#409)
    prevHero.legalActions = [];
    const prevBot = prev.players.find((p) => p.address !== TEST_ADDRESS)!;
    prevBot.status = "all-in";
    prevBot.holeCards = ["X", "X"]; // masked now, revealed on the runout's first beat
    prevBot.legalActions = [];
    const folder = { ...clone(prevBot), address: folderAddress, seat: folderSeat, status: "active", holeCards: ["X", "X"] };
    prev.players.push(folder);

    // ---- next: ONE terminal frame — the fold, the runout and the winner together ----
    const next = clone(prev);
    next.round = "end";
    next.communityCards = [...FULL_BOARD];
    next.nextToAct = NOBODY;
    const lastIndex = next.previousActions.length > 0 ? next.previousActions[next.previousActions.length - 1].index : next.actionCount;
    next.previousActions = [
        ...next.previousActions,
        { playerId: folderAddress, seat: folderSeat, action: "fold", amount: "0", round: "flop", index: lastIndex + 1, timestamp: Date.now() }
    ];
    next.actionCount = prev.actionCount + 1;
    const nextHero = next.players.find((p) => p.address === TEST_ADDRESS)!;
    nextHero.status = "showing";
    const nextBot = next.players.find((p) => p.address !== TEST_ADDRESS)!;
    nextBot.status = "showing";
    nextBot.holeCards = ["7S", "7D"]; // masked -> revealed: beat 0 of the expansion
    const nextFolder = next.players.find((p) => p.address === folderAddress)!;
    nextFolder.status = "folded";
    next.winners = [{ address: TEST_ADDRESS, seat: HERO_SEAT, amount: "4000000", cards: ["AS", "AH", "AD", "QH", "QD"] }];

    const foldCount = next.actionCount;

    await test.step("inject the flop, then the terminal fold+runout+winner frame", async () => {
        await inject(body, prev);
        await page.waitForTimeout(500); // let the flop frame commit so the expansion diffs flop -> end
        await inject(body, next);
        if (process.env.SHOTS_DIR) {
            // Mid-choreography: with the bug, the folder's seat is flashing a turn timer here.
            await page.waitForTimeout(1_200);
            await page.screenshot({ path: `${process.env.SHOTS_DIR}/${process.env.SHOT_PREFIX ?? "after"}-runout-stale-turn.png` });
        }
    });

    await test.step("the winner lands after the paced runout", async () => {
        await expect(page.locator(".seat-banner-text", { hasText: "WINS" })).toBeVisible({ timeout: 20_000 });
    });

    await test.step("no frame carrying the fold still points the turn at any seat", async () => {
        const commitLog = await page.evaluate(
            () => (window as unknown as { __B52_BUS__?: { commitLog: unknown[] } }).__B52_BUS__?.commitLog ?? []
        ) as CommitEntry[];

        const foldFrames = commitLog.filter((c) => c.actionCount === foldCount);
        // The runout must actually have been expanded — a single terminal commit
        // means the scenario under test never happened and the assertion is vacuous.
        expect(
            foldFrames.length,
            `expected the terminal frame to expand into sub-frames, commitLog: ${JSON.stringify(commitLog)}`
        ).toBeGreaterThanOrEqual(3);

        const stale = foldFrames.filter((c) => c.nextToAct !== NOBODY);
        expect(
            stale,
            `frames carrying the closing fold still point the turn at a seat (ui#968): ${JSON.stringify(stale)}`
        ).toHaveLength(0);
    });

    expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
