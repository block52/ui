import type { MoveIntentDTO, TournamentStateDTO, TournamentTableDTO } from "../types/tournament";
import {
    HOLD_BREAK,
    HOLD_FINAL_TABLE,
    INTENT_BALANCE,
    INTENT_BREAK,
    engineTableIdFromGameId,
    rebalanceNotice,
    tableNumberOf
} from "./rebalanceNotice";

const TID = "0xf7c46fa0c66eb470c6ddf1e4797ec75839099f3cd8e31c2ad5ca5e2b4b344d81";
const ME = "b521zc0wnv0rjuh796ytpkpuf59l73gzefc0wrwpra";
const OTHER = "b521otherplayer00000000000000000000000000";

const table = (ordinal: number, overrides: Partial<TournamentTableDTO> = {}): TournamentTableDTO => ({
    tableId: `${TID}/t${ordinal}`,
    ordinal,
    players: [OTHER],
    broken: false,
    handNumber: 4,
    atBoundary: false,
    ...overrides
});

const intent = (overrides: Partial<MoveIntentDTO> & Pick<MoveIntentDTO, "from" | "to" | "address">): MoveIntentDTO => ({
    key: "k1",
    seat: 3,
    reason: INTENT_BALANCE,
    ...overrides
});

const state = (overrides: Partial<TournamentStateDTO> = {}): TournamentStateDTO => ({
    tournamentId: TID,
    status: "running",
    options: {
        buyIn: "1000000",
        startingStack: "1500",
        seatsPerTable: 9,
        minEntrants: 2,
        maxEntrants: 27,
        startTime: 1,
        blindStructure: { preset: "turbo" },
        actionTimeoutSeconds: 5
    },
    entrants: [
        { address: ME, status: "playing", tableId: `${TID}/t1`, seat: 4, stack: "1500" },
        { address: OTHER, status: "playing", tableId: `${TID}/t2`, seat: 1, stack: "1500" }
    ],
    tables: [table(1), table(2)],
    level: 1,
    prizePool: "0",
    payouts: [],
    results: [],
    seq: 1,
    ...overrides
});

describe("engineTableIdFromGameId / tableNumberOf", () => {
    it("converts a directed-table game id and reads the table number", () => {
        expect(engineTableIdFromGameId(`${TID}-t3`)).toBe(`${TID}/t3`);
        expect(tableNumberOf(`${TID}-t3`)).toBe(3);
        expect(tableNumberOf(`${TID}/t3`)).toBe(3);
    });
});

describe("rebalanceNotice", () => {
    it("is silent during normal play", () => {
        expect(rebalanceNotice(state(), `${TID}-t1`, ME)).toBeUndefined();
        expect(rebalanceNotice(state({ intents: [] }), `${TID}-t1`, ME)).toBeUndefined();
    });

    it("is silent when the table is mid-hand even if a move is reserved", () => {
        const t = state({
            intents: [intent({ address: OTHER, from: `${TID}/t2`, to: `${TID}/t1` })],
            tables: [table(1, { atBoundary: false }), table(2, { atBoundary: true })]
        });
        expect(rebalanceNotice(t, `${TID}-t1`, ME)).toBeUndefined();
    });

    it("is silent during a scheduled level break", () => {
        const t = state({
            tables: [table(1, { atBoundary: true, hold: HOLD_BREAK }), table(2)]
        });
        expect(rebalanceNotice(t, `${TID}-t1`, ME)).toBeUndefined();
    });

    it("shows a waiting notice when this table is at the boundary with an incoming player", () => {
        const t = state({
            intents: [intent({ address: OTHER, from: `${TID}/t2`, to: `${TID}/t1` })],
            tables: [table(1, { atBoundary: true, players: [ME] }), table(2, { atBoundary: false })]
        });
        expect(rebalanceNotice(t, `${TID}-t1`, ME)).toEqual({ kind: "waiting" });
        // Spectators see it too
        expect(rebalanceNotice(t, `${TID}-t1`, undefined)).toEqual({ kind: "waiting" });
    });

    it("shows a waiting notice to players who stay on a table that is sending someone", () => {
        const t = state({
            intents: [intent({ address: OTHER, from: `${TID}/t1`, to: `${TID}/t2` })],
            tables: [table(1, { atBoundary: true, players: [ME, OTHER] }), table(2, { atBoundary: false })]
        });
        expect(rebalanceNotice(t, `${TID}-t1`, ME)).toEqual({ kind: "waiting" });
    });

    it("tells the moved player they are going to the destination table", () => {
        const t = state({
            intents: [intent({ address: ME, from: `${TID}/t1`, to: `${TID}/t3`, reason: INTENT_BREAK })],
            tables: [table(1, { atBoundary: true, players: [ME] }), table(2), table(3, { atBoundary: false })]
        });
        expect(rebalanceNotice(t, `${TID}-t1`, ME)).toEqual({ kind: "moving", tableNumber: 3, gameId: `${TID}-t3` });
        // Case-insensitive wallet match
        expect(rebalanceNotice(t, `${TID}-t1`, ME.toUpperCase())?.kind).toBe("moving");
        // A spectator of the breaking table still sees the generic wait
        expect(rebalanceNotice(t, `${TID}-t1`, undefined)).toEqual({ kind: "waiting" });
    });

    it("shows a waiting notice while the final-table barrier is up on this table", () => {
        const t = state({
            tables: [
                table(1, { atBoundary: true, hold: HOLD_FINAL_TABLE, players: [ME] }),
                table(2, { atBoundary: false, hold: HOLD_FINAL_TABLE, players: [OTHER] })
            ]
        });
        // Already on the lowest-ordinal live table: waiting, not moving.
        expect(rebalanceNotice(t, `${TID}-t1`, ME)).toEqual({ kind: "waiting" });
    });

    it("tells a player on a held non-final table they are being moved to it", () => {
        const t = state({
            entrants: [
                { address: ME, status: "playing", tableId: `${TID}/t2`, seat: 1, stack: "1500" },
                { address: OTHER, status: "playing", tableId: `${TID}/t1`, seat: 1, stack: "1500" }
            ],
            tables: [
                table(1, { atBoundary: true, hold: HOLD_FINAL_TABLE, players: [OTHER] }),
                table(2, { atBoundary: true, hold: HOLD_FINAL_TABLE, players: [ME] })
            ]
        });
        expect(rebalanceNotice(t, `${TID}-t2`, ME)).toEqual({ kind: "moving", tableNumber: 1, gameId: `${TID}-t1` });
        expect(rebalanceNotice(t, `${TID}-t2`, undefined)).toEqual({ kind: "waiting" });
    });

    it("shows a waiting notice on a short table at the boundary with no planned move yet", () => {
        const t = state({
            tables: [table(1, { atBoundary: true, players: [ME] }), table(2, { atBoundary: false, players: [OTHER] })]
        });
        expect(rebalanceNotice(t, `${TID}-t1`, ME)).toEqual({ kind: "waiting" });
    });

    it("prefers a pending follow-up move even after the intent has executed", () => {
        expect(rebalanceNotice(state(), `${TID}-t1`, ME, { gameId: `${TID}-t4`, tableNumber: 4 })).toEqual({
            kind: "moving",
            tableNumber: 4,
            gameId: `${TID}-t4`
        });
    });

    it("is silent when there is no tournament or the viewed id is not a directed table", () => {
        expect(rebalanceNotice(undefined, `${TID}-t1`, ME)).toBeUndefined();
        expect(rebalanceNotice(state({ status: "finished" }), `${TID}-t1`, ME)).toBeUndefined();
        expect(rebalanceNotice(state(), "0xabcabc", ME)).toBeUndefined();
    });
});
