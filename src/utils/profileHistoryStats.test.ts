import type { GamePrizeMeta } from "./transactionUtils";
import type { SessionPrizeRow } from "./playerPrizeClaims";
import { ALL_SESSION_GAMES, sessionLabelsByGameId } from "./sessionGameDisplay";
import {
    formatHistoryAmount,
    formatHistoryBlocks,
    handBelongsToSettledSession,
    handsForHistory,
    historyMoneyUnit,
    historyMoneyUnits,
    historyNetClass,
    openSessionTotalsNote,
    SESSION_CHAIN_STATE_DAYS,
    sessionStateRetentionNote,
    profileHistoryStats,
    settledSessionCashOut,
    sessionSpansForHistory,
    variantMoneyFromRows,
    variantMoneyTotals,
    withHandContributions,
    type HistoryHandAmount,
    type HistorySessionSpan
} from "./profileHistoryStats";

const cash = (overrides: Partial<GamePrizeMeta> = {}): GamePrizeMeta => ({
    format: "cash",
    variant: "texas-holdem",
    bettingLimit: "no-limit",
    smallBlind: "10000",
    bigBlind: "20000",
    ...overrides
});

const sitAndGo = (overrides: Partial<GamePrizeMeta> = {}): GamePrizeMeta => ({
    format: "sit-and-go",
    variant: "texas-holdem",
    bettingLimit: "no-limit",
    minBuyIn: "2000000",
    maxBuyIn: "2000000",
    ...overrides
});

const tournament = (overrides: Partial<GamePrizeMeta> = {}): GamePrizeMeta => ({
    format: "tournament",
    variant: "texas-holdem",
    bettingLimit: "no-limit",
    minBuyIn: "2000000",
    maxBuyIn: "2000000",
    ...overrides
});

const metas: Record<string, GamePrizeMeta> = {
    cashA: cash(),
    cashB: cash(),
    sng: sitAndGo(),
    tourn: tournament()
};

const labels = sessionLabelsByGameId(metas);
const units = historyMoneyUnits(metas);

const span = (gameId: string, joinBlock: number, leaveBlock?: number): HistorySessionSpan => ({ gameId, joinBlock, leaveBlock });

const hand = (gameId: string, wonAmount: number, contributed?: number): HistoryHandAmount =>
    hasValue(contributed) ? { gameId, wonAmount, contributed } : { gameId, wonAmount };

function hasValue(value: number | undefined): value is number {
    return value !== undefined;
}

const sessions: HistorySessionSpan[] = [
    span("cashA", 1_000_000, 1_000_400),
    span("cashB", 1_010_000, 1_010_900),
    span("sng", 1_020_000, 1_020_220),
    span("tourn", 1_030_000, 1_031_520),
    span("cashA", 1_050_000)
];

const hands: HistoryHandAmount[] = [
    hand("cashA", 4_200_000),
    hand("cashB", 18_400_000),
    hand("cashA", 0),
    hand("sng", 1_500),
    hand("sng", 4_200),
    hand("tourn", 8_600),
    hand("tourn", 24_600)
];

describe("historyMoneyUnit", () => {
    it("keeps cash in USDC and Sit & Go or tournament stacks in chips", () => {
        expect(historyMoneyUnit("cash")).toBe("usd");
        expect(historyMoneyUnit("sit-and-go")).toBe("chips");
        expect(historyMoneyUnit("tournament")).toBe("chips");
        expect(historyMoneyUnit(undefined)).toBeUndefined();
        expect(historyMoneyUnit("mixed")).toBeUndefined();
    });
});

describe("profileHistoryStats", () => {
    it("takes the longest closed session in the selected variant", () => {
        const all = profileHistoryStats(sessions, hands, labels, units, ALL_SESSION_GAMES);
        expect(all.longestSessionBlocks).toBe(1_520);

        const cashStats = profileHistoryStats(sessions, hands, labels, units, "Cash Game · Texas Hold'em");
        expect(cashStats.longestSessionBlocks).toBe(900);

        const sngStats = profileHistoryStats(sessions, hands, labels, units, "Sit & Go · Texas Hold'em");
        expect(sngStats.longestSessionBlocks).toBe(220);

        const tournStats = profileHistoryStats(sessions, hands, labels, units, "Tournament · Texas Hold'em");
        expect(tournStats.longestSessionBlocks).toBe(1_520);
    });

    it("does not treat an open seat, a same-block leave, or a backwards leave as a length of 0", () => {
        const openOnly = profileHistoryStats([span("cashA", 10)], [], labels, units, ALL_SESSION_GAMES);
        expect(openOnly.longestSessionBlocks).toBeUndefined();

        const zero = profileHistoryStats([span("cashA", 10, 10), span("cashA", 20, 19)], [], labels, units, ALL_SESSION_GAMES);
        expect(zero.longestSessionBlocks).toBeUndefined();

        const withReal = profileHistoryStats([span("cashA", 10, 10), span("cashA", 20, 25)], [], labels, units, "Cash Game · Texas Hold'em");
        expect(withReal.longestSessionBlocks).toBe(5);
    });

    it("uses the largest pot awarded in that variant's unit", () => {
        const cashStats = profileHistoryStats(sessions, hands, labels, units, "Cash Game · Texas Hold'em");
        expect(cashStats.biggestPotWon).toBe(18_400_000);
        expect(cashStats.potUnit).toBe("usd");

        const sngStats = profileHistoryStats(sessions, hands, labels, units, "Sit & Go · Texas Hold'em");
        expect(sngStats.biggestPotWon).toBe(4_200);
        expect(sngStats.potUnit).toBe("chips");

        const tournStats = profileHistoryStats(sessions, hands, labels, units, "Tournament · Texas Hold'em");
        expect(tournStats.biggestPotWon).toBe(24_600);
        expect(tournStats.potUnit).toBe("chips");
    });

    it("does not report a pot of 0 when the player never won a hand in the variant", () => {
        const stats = profileHistoryStats(sessions, [hand("cashA", 0)], labels, units, "Cash Game · Texas Hold'em");
        expect(stats.biggestPotWon).toBeUndefined();
        expect(stats.potUnit).toBeUndefined();
    });

    it("refuses one pot figure when All mixes cash dollars with tournament chips", () => {
        const stats = profileHistoryStats(sessions, hands, labels, units, ALL_SESSION_GAMES);
        expect(stats.biggestPotWon).toBeUndefined();
        expect(stats.potUnit).toBeUndefined();
        expect(stats.longestSessionBlocks).toBe(1_520);
    });

    it("refuses a pot when a winning hand has no table format", () => {
        const unlabeled = sessionLabelsByGameId({ ...metas, mystery: {} });
        const mixed = historyMoneyUnits({ ...metas, mystery: {} });
        const stats = profileHistoryStats(sessions, [...hands, hand("mystery", 9_000_000)], unlabeled, mixed, ALL_SESSION_GAMES);
        expect(stats.biggestPotWon).toBeUndefined();
    });

    it("keeps a variant's pot when the unlabeled hand is not in that variant", () => {
        const unlabeled = sessionLabelsByGameId({ ...metas, mystery: {} });
        const stats = profileHistoryStats(
            sessions,
            [...hands, hand("mystery", 9_000_000)],
            unlabeled,
            historyMoneyUnits({ ...metas, mystery: {} }),
            "Cash Game · Texas Hold'em"
        );
        expect(stats.biggestPotWon).toBe(18_400_000);
        expect(stats.potUnit).toBe("usd");
    });

    it("computes hand profit only from hands that record what the player put in", () => {
        const measured: HistoryHandAmount[] = [hand("cashA", 5_000_000, 1_000_000), hand("cashB", 2_000_000, 2_500_000), hand("cashA", 8_000_000)];
        const stats = profileHistoryStats(sessions, measured, labels, units, "Cash Game · Texas Hold'em");
        expect(stats.biggestHandProfit).toBe(4_000_000);
        expect(stats.profitUnit).toBe("usd");
        expect(stats.biggestPotWon).toBe(8_000_000);
    });

    it("leaves hand profit unknown when the hand list has no contribution", () => {
        const stats = profileHistoryStats(sessions, hands, labels, units, "Tournament · Texas Hold'em");
        expect(stats.biggestHandProfit).toBeUndefined();
        expect(stats.profitUnit).toBeUndefined();
        expect(stats.biggestPotWon).toBe(24_600);
    });

    it("picks the largest profit even when every measured hand lost money", () => {
        const measured = [hand("tourn", 1_000, 4_000), hand("tourn", 2_000, 2_500)];
        const stats = profileHistoryStats(sessions, measured, labels, units, "Tournament · Texas Hold'em");
        expect(stats.biggestHandProfit).toBe(-500);
        expect(stats.profitUnit).toBe("chips");
    });

    it("does not mix a cash profit with a chip profit", () => {
        const measured = [hand("cashA", 5_000_000, 1_000_000), hand("tourn", 3_000, 1_000)];
        const stats = profileHistoryStats(sessions, measured, labels, units, ALL_SESSION_GAMES);
        expect(stats.biggestHandProfit).toBeUndefined();
    });
});

describe("sessionSpansForHistory", () => {
    const player = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";

    it("keeps a leave block the session row already has", () => {
        const row: SessionPrizeRow = { gameId: "cashA", joinBlock: 10, leaveBlock: 40, buyIn: 1, cashOut: 2, isPrize: false };
        expect(sessionSpansForHistory([row], metas, player, {})).toEqual([{ gameId: "cashA", joinBlock: 10, leaveBlock: 40 }]);
    });

    it("uses the chain elimination block for a bust the table would show", () => {
        const row: SessionPrizeRow = { gameId: "tourn", joinBlock: 100, buyIn: 10_000, isPrize: false };
        const busted: GamePrizeMeta = {
            ...tournament(),
            handNumber: 3,
            results: [{ place: 2, playerId: player, payout: "0" }],
            payouts: [{ place: 1, amount: "27000" }],
            players: [{ address: player, stack: "0", status: "busted" }]
        };
        const [spanRow] = sessionSpansForHistory([row], { tourn: busted }, player, { tourn: 250 });
        expect(spanRow.leaveBlock).toBe(250);
        expect(
            profileHistoryStats([spanRow], [], sessionLabelsByGameId({ tourn: busted }), historyMoneyUnits({ tourn: busted }), ALL_SESSION_GAMES)
                .longestSessionBlocks
        ).toBe(150);
    });

    it("does not invent a leave block for a seat that is still open", () => {
        const row: SessionPrizeRow = { gameId: "cashA", joinBlock: 10, buyIn: 1, isPrize: false };
        expect(sessionSpansForHistory([row], metas, player, {})[0].leaveBlock).toBeUndefined();
    });
});

describe("variant money totals", () => {
    const player = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";
    const closed = (buyIn: number, cashOut: number, gameId = "cashA"): SessionPrizeRow => ({
        gameId,
        joinBlock: 10,
        buyIn,
        cashOut,
        isPrize: false
    });

    it("sums the buy-ins and cash-outs the table prints, and nets them", () => {
        const totals = variantMoneyTotals([
            { buyIn: 1_000_000, cashOut: 2_500_000 },
            { buyIn: 2_000_000, cashOut: 500_000 }
        ]);
        expect(totals).toEqual({ totalBuyIn: 3_000_000, totalCashOut: 3_000_000, netProfit: 0, excludedOpen: 0 });
        expect(historyNetClass(totals.netProfit!)).toBe("");
        expect(historyNetClass(1_000_000)).toBe("text-green-400");
        expect(historyNetClass(-1_000_000)).toBe("text-red-400");
    });

    it("leaves an open seat out of every total", () => {
        const totals = variantMoneyTotals([{ buyIn: 2_000_000, cashOut: 7_200_000 }, { buyIn: 10_000 }, { buyIn: 2_000_000 }]);
        expect(totals).toEqual({ totalBuyIn: 2_000_000, totalCashOut: 7_200_000, netProfit: 5_200_000, excludedOpen: 2 });
        expect(openSessionTotalsNote(2)).toBe("2 open sessions aren't in these totals");
        expect(openSessionTotalsNote(1)).toBe("1 open session isn't in these totals");
        expect(openSessionTotalsNote(0)).toBeUndefined();
        expect(SESSION_CHAIN_STATE_DAYS).toBe(23);
        expect(sessionStateRetentionNote()).toContain("last 23 days");
        expect(sessionStateRetentionNote()).toContain("Older rows show —");
    });

    it("has no totals when every seat is still open", () => {
        expect(variantMoneyTotals([{ buyIn: 1_000_000 }, { buyIn: 2_000_000 }])).toEqual({ excludedOpen: 2 });
    });

    it("counts a bust as a 0.00 cash-out and a prize as its claim", () => {
        const busted: GamePrizeMeta = {
            ...tournament(),
            handNumber: 3,
            results: [{ place: 2, playerId: player, payout: "0" }],
            payouts: [{ place: 1, amount: "27000" }],
            players: [{ address: player, stack: "0", status: "busted" }]
        };
        const bust: SessionPrizeRow = { gameId: "tourn", joinBlock: 200, buyIn: 2_000_000, isPrize: false };
        const prize: SessionPrizeRow = {
            gameId: "tourn",
            joinBlock: 100,
            buyIn: 2_000_000,
            cashOut: 7_200_000,
            isPrize: true,
            prizeTxHash: "ABC"
        };
        const open: SessionPrizeRow = { gameId: "cashA", joinBlock: 300, buyIn: 10_000, isPrize: false };
        const rows = [bust, prize, open];
        expect(settledSessionCashOut(bust, true)).toBe(0);
        expect(settledSessionCashOut(prize, false)).toBe(7_200_000);
        expect(settledSessionCashOut({ isPrize: true, prizeTxHash: "ABC" }, false)).toBeUndefined();
        expect(settledSessionCashOut(open, false)).toBeUndefined();
        expect(variantMoneyFromRows(rows, rows, { tourn: busted, cashA: cash() }, player)).toEqual({
            totalBuyIn: 4_000_000,
            totalCashOut: 7_200_000,
            netProfit: 3_200_000,
            excludedOpen: 1
        });
    });
});

describe("handBelongsToSettledSession", () => {
    const settled = { gameId: "cashA", joinBlock: 100, cashOut: 50 };
    const open = { gameId: "cashA", joinBlock: 300 };

    it("keeps a hand from a closed seat and drops one from the open re-entry", () => {
        expect(handBelongsToSettledSession({ gameId: "cashA", blockHeight: 150 }, [settled, open])).toBe(true);
        expect(handBelongsToSettledSession({ gameId: "cashA", blockHeight: 400 }, [settled, open])).toBe(false);
        expect(handBelongsToSettledSession({ gameId: "cashA", blockHeight: 50 }, [settled])).toBe(false);
        expect(handBelongsToSettledSession({ gameId: "cashA", blockHeight: 150 }, [{ ...settled, cashOut: 0 }])).toBe(true);
    });

    it("counts an MTT hand dealt on another table of the same tournament inside the settled window", () => {
        const tournament = "0x275a79b9258009e0a1f4f4f4232cefe25262765f0a5c7c3a86040885ffec5187";
        const mtt = { gameId: `${tournament}-t1`, joinBlock: 1_059_332, cashOut: 0 };
        const running = { gameId: `${tournament}-t1`, joinBlock: 1_059_332 };
        expect(handBelongsToSettledSession({ gameId: `${tournament}-t1`, blockHeight: 1_059_805 }, [mtt])).toBe(true);
        expect(handBelongsToSettledSession({ gameId: `${tournament}-t2`, blockHeight: 1_059_700 }, [mtt])).toBe(true);
        expect(handBelongsToSettledSession({ gameId: `${tournament}-t2`, blockHeight: 1_059_000 }, [mtt])).toBe(false);
        expect(handBelongsToSettledSession({ gameId: "0xother-t1", blockHeight: 1_059_805 }, [mtt])).toBe(false);
        expect(handBelongsToSettledSession({ gameId: `${tournament}-t2`, blockHeight: 1_059_805 }, [running])).toBe(false);
    });
});

describe("handsForHistory", () => {
    it("keeps the awarded amount and the hand number, and does not invent a contribution", () => {
        expect(
            handsForHistory([
                {
                    game_id: "cashA",
                    hand_number: 1,
                    seat: 1,
                    status: "showing",
                    won_amount: 18_400_000,
                    block_height: 1,
                    community_cards: [],
                    winner_count: 1
                }
            ])
        ).toEqual([{ gameId: "cashA", handNumber: 1, wonAmount: 18_400_000 }]);
    });
});

describe("withHandContributions", () => {
    it("attaches a chain contribution only for the hand that was read", () => {
        const rows = [
            { gameId: "cashA", handNumber: 4, wonAmount: 5_000_000 },
            { gameId: "cashA", handNumber: 5, wonAmount: 0 },
            { gameId: "cashB", wonAmount: 1_000_000 }
        ];
        expect(withHandContributions(rows, { "cashA#4": 1_000_000 })).toEqual([
            { gameId: "cashA", handNumber: 4, wonAmount: 5_000_000, contributed: 1_000_000 },
            { gameId: "cashA", handNumber: 5, wonAmount: 0 },
            { gameId: "cashB", wonAmount: 1_000_000 }
        ]);
    });
});

describe("formatHistoryAmount", () => {
    it("formats cash as the other profile money cards do, and chips as chips", () => {
        expect(formatHistoryAmount(18_400_000, "usd", false)).toBe("18.40");
        expect(formatHistoryAmount(24_600, "chips", false)).toBe(`${(24_600).toLocaleString()} chips`);
        expect(formatHistoryAmount(24_600, "chips", false)).not.toBe("0.02");
    });

    it("shows an em dash for an unknown figure and an ellipsis while the hands are loading", () => {
        expect(formatHistoryAmount(undefined, "usd", false)).toBe("—");
        expect(formatHistoryAmount(18_400_000, undefined, false)).toBe("—");
        expect(formatHistoryAmount(0, "usd", false)).toBe("0.00");
        expect(formatHistoryAmount(18_400_000, "usd", true)).toBe("…");
    });

    it("shows an em dash for an unmeasured session and the block count otherwise", () => {
        expect(formatHistoryBlocks(undefined, false)).toBe("—");
        expect(formatHistoryBlocks(1_520, false)).toBe((1_520).toLocaleString());
        expect(formatHistoryBlocks(1_520, true)).toBe("…");
    });
});
