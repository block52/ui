import { parseGamePrizeMeta, type GamePrizeMeta } from "./transactionUtils";
import {
    ALL_SESSION_GAMES,
    defaultSessionVariant,
    filterSessionRows,
    sessionRowExpandDetail,
    sessionGameFilterOptions,
    sessionGameLabel,
    sessionLabelsByGameId,
    sessionPrizePlaceLabel,
    uniqueGameIds
} from "./sessionGameDisplay";

const cash = (overrides: Partial<GamePrizeMeta> = {}): GamePrizeMeta => ({
    format: "cash",
    variant: "texas-holdem",
    bettingLimit: "no-limit",
    smallBlind: "10000",
    bigBlind: "20000",
    minBuyIn: "100000",
    maxBuyIn: "2000000",
    ...overrides
});

const sitAndGo = (overrides: Partial<GamePrizeMeta> = {}): GamePrizeMeta => ({
    format: "sit-and-go",
    variant: "texas-holdem",
    bettingLimit: "no-limit",
    smallBlind: "10",
    bigBlind: "20",
    minBuyIn: "2000000",
    maxBuyIn: "2000000",
    ...overrides
});

describe("sessionGameLabel", () => {
    it("names a cash game with its variant and the blind stakes", () => {
        expect(sessionGameLabel(cash())).toEqual({
            title: "Cash Game · Texas Hold'em",
            detail: "$0.01 / $0.02",
            filterKey: "Cash Game · Texas Hold'em"
        });
    });

    it("names pot-limit Omaha from the chain limit instead of calling it Hold'em", () => {
        expect(sessionGameLabel(cash({ variant: "omaha", bettingLimit: "pot-limit" }))?.title).toBe("Cash Game · Pot-Limit Omaha");
    });

    it("shows a Sit & Go buy-in and does not treat chip blinds as dollars", () => {
        expect(sessionGameLabel(sitAndGo())).toEqual({
            title: "Sit & Go · Texas Hold'em",
            detail: "$2.00 buy-in",
            filterKey: "Sit & Go · Texas Hold'em"
        });
    });

    it("shows a buy-in range when the two ends differ", () => {
        expect(sessionGameLabel(cash())?.detail).toBe("$0.01 / $0.02");
        expect(sessionGameLabel(sitAndGo({ minBuyIn: "100000", maxBuyIn: "2000000" }))?.detail).toBe("$0.10 – $2.00 buy-in");
    });

    it("calls a scheduled sit-and-go a single-table tournament, matching the lobby", () => {
        expect(sessionGameLabel(sitAndGo({ scheduledStartTime: 1_700_000_000_000 }))?.title).toBe("Tournament · Texas Hold'em");
        expect(sessionGameLabel(sitAndGo({ format: "tournament", scheduledStartTime: 1_700_000_000_000 }))?.title).toBe("Tournament · Texas Hold'em");
        expect(sessionGameLabel(sitAndGo({ format: "tournament" }), "0xabc-t1")?.title).toBe("Multi-table tournament · Texas Hold'em");
    });

    it("leaves the variant and the stake off when the record doesn't have them", () => {
        expect(sessionGameLabel({ format: "cash" })).toEqual({ title: "Cash Game", filterKey: "Cash Game" });
        expect(sessionGameLabel({ format: "sit-and-go", variant: "not-a-variant", minBuyIn: "10000", maxBuyIn: "10000" })).toEqual({
            title: "Sit & Go",
            detail: "$0.01 buy-in",
            filterKey: "Sit & Go"
        });
    });

    it("returns nothing when the format is missing, rather than assuming Hold'em", () => {
        expect(sessionGameLabel(undefined)).toBeUndefined();
        expect(sessionGameLabel({ variant: "texas-holdem", smallBlind: "10000", bigBlind: "20000" })).toBeUndefined();
        expect(sessionGameLabel({ format: "mixed" as GamePrizeMeta["format"] })).toBeUndefined();
    });

    it("reads variant, blinds and buy-in from the chain game payload", () => {
        const meta = parseGamePrizeMeta({
            game: JSON.stringify({
                format: "sit-and-go",
                variant: "texas-holdem",
                gameState: {
                    gameOptions: {
                        bettingLimit: "no-limit",
                        smallBlind: "50",
                        bigBlind: "100",
                        minBuyIn: "1000000",
                        maxBuyIn: "1000000",
                        scheduledStartTime: 0
                    },
                    results: [{ place: 2, playerId: "b521p", payout: "400000" }],
                    payouts: [{ place: 2, amount: "400000" }]
                }
            })
        });
        expect(meta).toMatchObject({
            format: "sit-and-go",
            variant: "texas-holdem",
            bettingLimit: "no-limit",
            smallBlind: "50",
            bigBlind: "100",
            minBuyIn: "1000000",
            maxBuyIn: "1000000",
            results: [{ place: 2, playerId: "b521p", payout: "400000" }]
        });
        expect(meta.scheduledStartTime).toBeUndefined();
        expect(sessionGameLabel(meta)?.title).toBe("Sit & Go · Texas Hold'em");
        expect(sessionGameLabel(meta)?.detail).toBe("$1.00 buy-in");
    });
});

describe("session game filter", () => {
    const labels = [
        sessionGameLabel(sitAndGo()),
        sessionGameLabel(cash()),
        sessionGameLabel(cash()),
        sessionGameLabel(sitAndGo({ format: "tournament" })),
        sessionGameLabel(cash({ variant: "omaha", bettingLimit: "pot-limit" })),
        sessionGameLabel(undefined)
    ];

    it("lists each distinct label once, cash then sit & go then tournament", () => {
        expect(sessionGameFilterOptions(labels)).toEqual([
            { key: "Cash Game · Pot-Limit Omaha", label: "Cash Game · Pot-Limit Omaha" },
            { key: "Cash Game · Texas Hold'em", label: "Cash Game · Texas Hold'em" },
            { key: "Sit & Go · Texas Hold'em", label: "Sit & Go · Texas Hold'em" },
            { key: "Tournament · Texas Hold'em", label: "Tournament · Texas Hold'em" }
        ]);
    });

    it("keeps every row for All and only the matching label otherwise", () => {
        const byId = {
            cash: cash(),
            sng: sitAndGo(),
            gone: {}
        };
        const labelsById = sessionLabelsByGameId(byId);
        const rows = [{ gameId: "cash" }, { gameId: "sng" }, { gameId: "gone" }];
        expect(filterSessionRows(rows, labelsById, ALL_SESSION_GAMES).map(row => row.gameId)).toEqual(["cash", "sng", "gone"]);
        expect(filterSessionRows(rows, labelsById, "Sit & Go · Texas Hold'em").map(row => row.gameId)).toEqual(["sng"]);
        expect(filterSessionRows(rows, labelsById, "")).toEqual(rows);
    });
});

describe("sessionRowExpandDetail", () => {
    it("shows the join, the leave, and the length in blocks", () => {
        expect(sessionRowExpandDetail(1_000_000, 1_000_400)).toEqual({
            joinBlock: (1_000_000).toLocaleString(),
            leaveBlock: (1_000_400).toLocaleString(),
            length: `${(400).toLocaleString()} blocks`
        });
    });

    it("leaves the length blank when the seat has not left, or the leave is not later", () => {
        expect(sessionRowExpandDetail(1_020_000, undefined)).toEqual({
            joinBlock: (1_020_000).toLocaleString(),
            leaveBlock: "—",
            length: "—"
        });
        expect(sessionRowExpandDetail(10, 10).length).toBe("—");
        expect(sessionRowExpandDetail(20, 19).length).toBe("—");
    });
});

describe("defaultSessionVariant", () => {
    const labels = sessionLabelsByGameId({
        cash: cash(),
        omaha: cash({ variant: "omaha", bettingLimit: "pot-limit" }),
        sng: sitAndGo(),
        tourn: sitAndGo({ format: "tournament" })
    });
    const row = (gameId: string, joinBlock: number) => ({ gameId, joinBlock });

    it("picks the variant with the most sessions", () => {
        expect(defaultSessionVariant([row("cash", 10), row("tourn", 20), row("tourn", 30), row("sng", 40)], labels)).toBe("Tournament · Texas Hold'em");
    });

    it("breaks a tie with the most recent join", () => {
        expect(defaultSessionVariant([row("cash", 10), row("cash", 50), row("tourn", 20), row("tourn", 40)], labels)).toBe("Cash Game · Texas Hold'em");
        expect(defaultSessionVariant([row("cash", 10), row("cash", 30), row("tourn", 20), row("tourn", 40)], labels)).toBe("Tournament · Texas Hold'em");
    });

    it("uses menu order when the count and the latest join are the same", () => {
        expect(defaultSessionVariant([row("tourn", 10), row("cash", 10)], labels)).toBe("Cash Game · Texas Hold'em");
    });

    it("ignores a session whose game has no label", () => {
        expect(defaultSessionVariant([row("gone", 99), row("gone", 100), row("sng", 5)], labels)).toBe("Sit & Go · Texas Hold'em");
        expect(defaultSessionVariant([row("gone", 1)], labels)).toBeUndefined();
        expect(defaultSessionVariant([], labels)).toBeUndefined();
    });
});

describe("sessionPrizePlaceLabel", () => {
    const player = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";
    const prize = { isPrize: true, cashOut: 6_240_000 };

    it("uses the place on the player's result", () => {
        const meta: GamePrizeMeta = {
            format: "tournament",
            results: [
                { place: 1, playerId: player, payout: "6240000" },
                { place: 2, playerId: "b521other", payout: "3360000" }
            ],
            payouts: [
                { place: 1, amount: "6240000" },
                { place: 2, amount: "3360000" }
            ]
        };
        expect(sessionPrizePlaceLabel(prize, meta, player)).toBe("1st");
        expect(sessionPrizePlaceLabel({ isPrize: true, cashOut: 3_360_000 }, meta, "B521OTHER")).toBe("2nd");
    });

    it("prefers results over a payout amount that would say something else", () => {
        const meta: GamePrizeMeta = {
            format: "sit-and-go",
            results: [{ place: 3, playerId: player, payout: "2880000" }],
            payouts: [
                { place: 1, amount: "2880000" },
                { place: 3, amount: "2880000" }
            ]
        };
        expect(sessionPrizePlaceLabel({ isPrize: true, cashOut: 2_880_000 }, meta, player)).toBe("3rd");
    });

    it("uses a payout amount only when exactly one place pays it", () => {
        const unique: GamePrizeMeta = {
            format: "sit-and-go",
            payouts: [
                { place: 1, amount: "7200000" },
                { place: 2, amount: "4320000" }
            ]
        };
        expect(sessionPrizePlaceLabel({ isPrize: true, cashOut: 4_320_000 }, unique, player)).toBe("2nd");
        const tied: GamePrizeMeta = {
            format: "sit-and-go",
            payouts: [
                { place: 2, amount: "100" },
                { place: 3, amount: "100" }
            ]
        };
        expect(sessionPrizePlaceLabel({ isPrize: true, cashOut: 100 }, tied, player)).toBeUndefined();
    });

    it("shows nothing for an open row, a missing record, or a prize with no place", () => {
        const meta: GamePrizeMeta = { format: "sit-and-go", results: [{ place: 4, playerId: "b521someone", payout: "0" }] };
        expect(sessionPrizePlaceLabel({ isPrize: false, cashOut: 0 }, meta, player)).toBeUndefined();
        expect(sessionPrizePlaceLabel(prize, undefined, player)).toBeUndefined();
        expect(sessionPrizePlaceLabel(prize, meta, player)).toBeUndefined();
        expect(sessionPrizePlaceLabel(prize, { format: "sit-and-go" }, player)).toBeUndefined();
    });
});

describe("uniqueGameIds", () => {
    it("drops blanks and repeats, keeping the first order", () => {
        expect(uniqueGameIds(["0xa", undefined, "0xa", "", "0xb"])).toEqual(["0xa", "0xb"]);
    });
});
