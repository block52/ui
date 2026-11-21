import type { SessionPrizeRow } from "./playerPrizeClaims";
import {
    eliminationBlockFromHands,
    eliminationLookupsFor,
    findEliminationBlock,
    handEndedBlock,
    playerIsEliminated,
    sessionBustFor,
    sessionLeaveBlock,
    type HandProbe
} from "./sessionBust";
import { parseGamePrizeMeta, type GamePrizeMeta } from "./transactionUtils";

const PLAYER = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";
const OTHER = "b5215ms209pk2fu5ej79dr56vynjt9q6hmakxn89wg";
const THIRD = "b521krvavrkrgk3rv5y7t2p6gh6pezz0f5a2f2tyeh";
const GAME = "0x7db1aa4491963b889ad43dd7213d11e383b1052aacb9ceafe3099b42ae0797e7";

const row = (overrides: Partial<SessionPrizeRow> = {}): SessionPrizeRow => ({
    gameId: GAME,
    joinBlock: 1024503,
    buyIn: 10000,
    isPrize: false,
    ...overrides
});

/** The finished $0.01 tournament this player busted in 2nd, payout 0. */
const finished = (overrides: Partial<GamePrizeMeta> = {}): GamePrizeMeta => ({
    format: "tournament",
    handNumber: 3,
    results: [
        { place: 3, playerId: THIRD, payout: "0" },
        { place: 2, playerId: PLAYER, payout: "0" },
        { place: 1, playerId: OTHER, payout: "27000" }
    ],
    payouts: [{ place: 1, amount: "27000" }],
    players: [
        { address: THIRD, stack: "0", status: "busted" },
        { address: PLAYER, stack: "0", status: "busted" },
        { address: OTHER, stack: "4500", status: "showing" }
    ],
    ...overrides
});

describe("sessionBustFor", () => {
    it("shows 0.00 and the results place once the player is eliminated, even mid-tournament", () => {
        const open = row();
        const meta = finished({
            results: [
                { place: 3, playerId: THIRD, payout: "0" },
                { place: 2, playerId: PLAYER, payout: "0" }
            ]
        });
        expect(sessionBustFor(open, [open], meta, PLAYER)).toEqual({ placeLabel: "2nd" });
        const done = row();
        expect(sessionBustFor(done, [done], finished(), PLAYER.toUpperCase())).toEqual({ placeLabel: "2nd" });
    });

    it("shows 0.00 with no place when the tournament is over and the player is busted but unplaced", () => {
        const meta = finished({
            results: [{ place: 1, playerId: OTHER, payout: "27000" }],
            players: [
                { address: PLAYER, stack: "0", status: "busted" },
                { address: OTHER, stack: "4500", status: "showing" }
            ]
        });
        const open = row();
        expect(sessionBustFor(open, [open], meta, PLAYER)).toEqual({});
    });

    it("shows 0.00 with no place when a finished tournament no longer has the player seated", () => {
        const open = row();
        const meta = finished({
            results: [{ place: 1, playerId: OTHER, payout: "27000" }],
            players: [{ address: OTHER, stack: "4500", status: "showing" }]
        });
        expect(sessionBustFor(open, [open], meta, PLAYER)).toEqual({});
    });

    it("keeps an em dash while the player is still in a running tournament", () => {
        const open = row();
        const meta = finished({
            results: [{ place: 4, playerId: THIRD, payout: "0" }],
            players: [
                { address: THIRD, stack: "0", status: "busted" },
                { address: PLAYER, stack: "1500", status: "active" }
            ]
        });
        expect(sessionBustFor(open, [open], meta, PLAYER)).toBeUndefined();
    });

    it("keeps an em dash when the tournament is over but the seat still has chips and no result", () => {
        const meta = finished({
            results: [{ place: 1, playerId: OTHER, payout: "27000" }],
            players: [
                { address: PLAYER, stack: "800", status: "active" },
                { address: OTHER, stack: "4500", status: "showing" }
            ]
        });
        const open = row();
        expect(sessionBustFor(open, [open], meta, PLAYER)).toBeUndefined();
    });

    it("keeps an em dash when the record has no seats to confirm a missing result", () => {
        const open = row();
        const meta = finished({
            results: [{ place: 1, playerId: OTHER, payout: "27000" }],
            players: undefined
        });
        expect(sessionBustFor(open, [open], meta, PLAYER)).toBeUndefined();
    });

    it("leaves a paid place to the prize row", () => {
        const meta = finished({
            results: [
                { place: 1, playerId: PLAYER, payout: "7200000" },
                { place: 2, playerId: OTHER, payout: "0" }
            ]
        });
        const open = row();
        expect(sessionBustFor(open, [open], meta, PLAYER)).toBeUndefined();
        const claimed = row({ isPrize: true, cashOut: 7_200_000, leaveBlock: 1028676, prizeTxHash: "ABC" });
        expect(sessionBustFor(claimed, [claimed], meta, PLAYER)).toBeUndefined();
    });

    it("does not treat a missing payout as a bust", () => {
        const open = row();
        const meta = finished({ results: [{ place: 2, playerId: PLAYER }] });
        expect(sessionBustFor(open, [open], meta, PLAYER)).toBeUndefined();
    });

    it("leaves cash games and closed sessions alone", () => {
        const open = row();
        expect(sessionBustFor(open, [open], finished({ format: "cash" }), PLAYER)).toBeUndefined();
        const untyped = row();
        expect(sessionBustFor(untyped, [untyped], finished({ format: undefined }), PLAYER)).toBeUndefined();
        const closed = row({ leaveBlock: 1024600, cashOut: 0 });
        expect(sessionBustFor(closed, [closed], finished(), PLAYER)).toBeUndefined();
    });

    it("applies the finish to the latest open join only", () => {
        const earlier = row({ joinBlock: 100 });
        const later = row({ joinBlock: 300 });
        const rows = [earlier, later];
        expect(sessionBustFor(earlier, rows, finished(), PLAYER)).toBeUndefined();
        expect(sessionBustFor(later, rows, finished(), PLAYER)).toEqual({ placeLabel: "2nd" });
    });

    it("reads hand count, seats and a zero payout from the chain game payload", () => {
        const meta = parseGamePrizeMeta({
            game: JSON.stringify({
                format: "tournament",
                variant: "texas-holdem",
                gameState: {
                    handNumber: 3,
                    players: [
                        { address: PLAYER, stack: "0", status: "busted", holeCards: ["X", "X"] },
                        { stack: "0", status: "busted" }
                    ],
                    results: [{ place: 2, playerId: PLAYER, payout: "0" }],
                    payouts: [{ place: 1, amount: "27000" }]
                }
            })
        });
        expect(meta.handNumber).toBe(3);
        expect(meta.players).toEqual([{ address: PLAYER, stack: "0", status: "busted" }]);
        const open = row();
        expect(sessionBustFor(open, [open], meta, PLAYER)).toEqual({ placeLabel: "2nd" });
    });
});

describe("session leave block", () => {
    const bust = { placeLabel: "2nd" };

    it("keeps a recorded leave and only fills a bust from a found block", () => {
        expect(sessionLeaveBlock(row({ leaveBlock: 50 }), bust, 99)).toBe(50);
        expect(sessionLeaveBlock(row(), bust, 1024532)).toBe(1024532);
        expect(sessionLeaveBlock(row(), bust, null)).toBeUndefined();
        expect(sessionLeaveBlock(row(), undefined, 1024532)).toBeUndefined();
    });
});

describe("eliminationLookupsFor", () => {
    it("asks only for visible bust rows that have a hand count", () => {
        const busted = row();
        const running = row({ gameId: "0xrunning", joinBlock: 10 });
        const rows = [busted, running];
        const metas = {
            [GAME]: finished(),
            "0xrunning": finished({
                handNumber: 4,
                results: [],
                players: [{ address: PLAYER, stack: "1500", status: "active" }]
            })
        };
        expect(eliminationLookupsFor(rows, rows, metas, PLAYER)).toEqual([{ gameId: GAME, handCount: 3 }]);
        expect(eliminationLookupsFor([busted], rows, { [GAME]: finished({ handNumber: undefined }) }, PLAYER)).toEqual([]);
        expect(eliminationLookupsFor(rows, rows, metas, undefined)).toEqual([]);
    });
});

describe("handEndedBlock", () => {
    const ended = (code: number | string, height: string) => ({
        code,
        height,
        events: [
            {
                type: "hand_ended",
                attributes: [
                    { key: "game_id", value: GAME },
                    { key: "hand_number", value: "3" },
                    { key: "block_height", value: height }
                ]
            }
        ]
    });

    it("uses the hand_ended block of a successful tx", () => {
        expect(handEndedBlock({ tx_responses: [ended(0, "1024532")] })).toBe(1024532);
        expect(handEndedBlock({ tx_responses: [ended("0", "1024532")] })).toBe(1024532);
    });

    it("skips a failed tx and an empty page", () => {
        expect(handEndedBlock({ tx_responses: [ended(1, "1024532"), ended(0, "1024533")] })).toBe(1024533);
        expect(handEndedBlock({ tx_responses: [] })).toBeUndefined();
        expect(handEndedBlock({})).toBeUndefined();
    });

    it("falls back to the tx height when the event omits block_height", () => {
        expect(
            handEndedBlock({
                tx_responses: [{ code: 0, height: "1024514", events: [{ type: "hand_ended", attributes: [{ key: "hand_number", value: "1" }] }] }]
            })
        ).toBe(1024514);
    });
});

describe("playerIsEliminated", () => {
    const state = (results: unknown, players: unknown) => ({
        game_state: JSON.stringify({ handNumber: 3, results, players })
    });

    it("is true once results list the player, including a wrapped game state", () => {
        expect(playerIsEliminated(state([{ place: 2, playerId: PLAYER, payout: "0" }], []), PLAYER)).toBe(true);
        const wrapped = {
            game_state: JSON.stringify({ gameState: { results: [{ place: 2, playerId: PLAYER.toUpperCase(), payout: "0" }], players: [] } })
        };
        expect(playerIsEliminated(wrapped, PLAYER)).toBe(true);
    });

    it("is true for a busted seat that results have not placed yet", () => {
        expect(playerIsEliminated(state([], [{ address: PLAYER, status: "busted", stack: "0" }]), PLAYER)).toBe(true);
    });

    it("is false while the player is still seated and not in results", () => {
        expect(playerIsEliminated(state([{ place: 3, playerId: THIRD, payout: "0" }], [{ address: PLAYER, status: "active", stack: "1500" }]), PLAYER)).toBe(false);
    });

    it("is null when the body is not a game state", () => {
        expect(playerIsEliminated({ game_state: "not-json" }, PLAYER)).toBeNull();
        expect(playerIsEliminated({}, PLAYER)).toBeNull();
    });
});

describe("eliminationBlockFromHands", () => {
    const ended = (block: number, eliminated: boolean): HandProbe => ({ status: "ended", block, eliminated });

    function search(hands: Array<HandProbe | undefined>, handCount = hands.length): Promise<number | undefined> {
        return eliminationBlockFromHands(handCount, async hand => hands[hand - 1] ?? { status: "unknown" });
    }

    it("returns the block of the first hand that eliminated the player", async () => {
        await expect(search([ended(1024514, false), ended(1024525, false), ended(1024532, true)])).resolves.toBe(1024532);
        await expect(search([ended(10, true), ended(20, true)])).resolves.toBe(10);
    });

    it("treats an in-progress last hand as not the elimination", async () => {
        await expect(search([ended(10, false), ended(20, true), { status: "open" }])).resolves.toBe(20);
    });

    it("returns nothing when the player never shows as eliminated", async () => {
        await expect(search([ended(10, false), ended(20, false)])).resolves.toBeUndefined();
        await expect(search([], 0)).resolves.toBeUndefined();
    });

    it("aborts when a read fails instead of using a later hand", async () => {
        await expect(search([{ status: "unknown" }, ended(20, true)])).resolves.toBeUndefined();
    });
});

describe("findEliminationBlock", () => {
    it("confirms the hand_ended block against the public state", async () => {
        const hands: Record<string, { height: string; eliminated: boolean }> = {
            "1": { height: "1024514", eliminated: false },
            "2": { height: "1024525", eliminated: false },
            "3": { height: "1024532", eliminated: true }
        };
        const asked: string[] = [];
        const block = await findEliminationBlock(GAME, 3, PLAYER, {
            handEnded: async query => {
                const hand = /hand_number='(\d+)'/.exec(query)?.[1] ?? "";
                asked.push(hand);
                const height = hands[hand]?.height;
                if (!height) return { tx_responses: [] };
                return {
                    tx_responses: [
                        {
                            code: 0,
                            height,
                            events: [{ type: "hand_ended", attributes: [{ key: "block_height", value: height }] }]
                        }
                    ]
                };
            },
            stateAt: async (_gameId, height) => ({
                game_state: JSON.stringify({
                    results: height >= 1024532 ? [{ place: 2, playerId: PLAYER, payout: "0" }] : [],
                    players: [{ address: PLAYER, status: height >= 1024532 ? "busted" : "active", stack: height >= 1024532 ? "0" : "1500" }]
                })
            })
        });
        expect(block).toBe(1024532);
        expect(asked).toContain("3");
        expect(asked).toContain("2");
    });

    it("returns nothing when the state read fails", async () => {
        const block = await findEliminationBlock(GAME, 1, PLAYER, {
            handEnded: async () => ({
                tx_responses: [{ code: 0, height: "10", events: [{ type: "hand_ended", attributes: [{ key: "block_height", value: "10" }] }] }]
            }),
            stateAt: async () => {
                throw new Error("pruned");
            }
        });
        expect(block).toBeUndefined();
    });
});
