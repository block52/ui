import { deriveEvents, RegressedSnapshotError } from "./deriveEvents";
import {
    TexasHoldemStateDTO,
    ActionDTO,
    PlayerDTO,
    WinnerDTO,
    GameOptionsDTO,
    PlayerActionType,
    NonPlayerActionType,
    TexasHoldemRound,
    PlayerStatus
} from "@block52/poker-vm-sdk";
import type { GameEvent } from "./types";

const OPTIONS: GameOptionsDTO = {
    minBuyIn: "400000",
    maxBuyIn: "2000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "10000",
    bigBlind: "20000",
    timeout: 30
};

const ALICE = "b521fd4p40h6gm9vxfna8qvsqmv0e9upqsg66qpft9";
const BOB = "b521s8aug28r6vned2xm767xhgrkg90wfef2hfg4mg";

function action(index: number, over: Partial<ActionDTO> = {}): ActionDTO {
    return {
        playerId: ALICE,
        seat: 1,
        action: PlayerActionType.CHECK,
        amount: "0",
        round: TexasHoldemRound.PREFLOP,
        index,
        timestamp: 1_700_000_000_000 + index,
        ...over
    };
}

function player(seat: number, over: Partial<PlayerDTO> = {}): PlayerDTO {
    return {
        address: seat === 1 ? ALICE : BOB,
        seat,
        stack: "1000000",
        isSmallBlind: false,
        isBigBlind: false,
        isDealer: false,
        holeCards: ["X", "X"],
        status: PlayerStatus.ACTIVE,
        lastAction: undefined,
        legalActions: [],
        sumOfBets: "0",
        timeout: 30,
        signature: "",
        ...over
    };
}

function snapshot(over: Partial<TexasHoldemStateDTO> = {}): TexasHoldemStateDTO {
    return {
        gameOptions: OPTIONS,
        players: [player(1), player(4, { address: BOB })],
        communityCards: [],
        deck: "X",
        pots: ["0"],
        totalPot: "0",
        nextToAct: 1,
        previousActions: [],
        actionCount: 0,
        handNumber: 1,
        round: TexasHoldemRound.PREFLOP,
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: "",
        ...over
    };
}

function playerActed(events: GameEvent[]): ActionDTO[] {
    return events.filter((e): e is Extract<GameEvent, { type: "playerActed" }> => e.type === "playerActed").map(e => e.action);
}

function ofType<T extends GameEvent["type"]>(events: GameEvent[], type: T): Extract<GameEvent, { type: T }>[] {
    return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

describe("deriveEvents", () => {
    describe("first frame / seeding", () => {
        it("returns no synthetic events when prev is undefined (does not replay history)", () => {
            const next = snapshot({
                handNumber: 4,
                previousActions: [action(34), action(35), action(36)]
            });
            expect(deriveEvents(undefined, next)).toEqual([]);
        });
    });

    describe("playerActed", () => {
        it("emits one playerActed per new previousActions entry", () => {
            const prev = snapshot({ previousActions: [action(1)] });
            const next = snapshot({ previousActions: [action(1), action(2, { action: PlayerActionType.CALL })] });

            const acted = playerActed(deriveEvents(prev, next));
            expect(acted).toHaveLength(1);
            expect(acted[0].index).toBe(2);
            expect(acted[0].action).toBe(PlayerActionType.CALL);
        });

        it("emits nothing for a duplicate frame (same indices re-sent)", () => {
            const prev = snapshot({ previousActions: [action(1), action(2)] });
            const next = snapshot({ previousActions: [action(1), action(2)] });
            expect(playerActed(deriveEvents(prev, next))).toHaveLength(0);
        });

        it("emits several events in index order for a multi-action gap (coalesced upstream)", () => {
            const prev = snapshot({ previousActions: [action(1)] });
            const next = snapshot({
                // arrive out of order to prove sorting
                previousActions: [action(1), action(4, { action: PlayerActionType.BET }), action(2, { action: PlayerActionType.CALL }), action(3, { action: PlayerActionType.CHECK })]
            });

            const acted = playerActed(deriveEvents(prev, next));
            expect(acted.map(a => a.index)).toEqual([2, 3, 4]);
        });

        it("uses the globally-monotonic index baseline (no per-hand reset across the array swap)", () => {
            // Hand 3 ended at index 33; hand 4's array is replaced with 34+.
            const prev = snapshot({ handNumber: 3, previousActions: [action(32), action(33)] });
            const next = snapshot({
                handNumber: 4,
                previousActions: [
                    action(34, { seat: 4, playerId: BOB, action: PlayerActionType.SMALL_BLIND, round: TexasHoldemRound.ANTE }),
                    action(35, { action: PlayerActionType.BIG_BLIND, round: TexasHoldemRound.ANTE }),
                    action(36, { seat: 4, playerId: BOB, action: NonPlayerActionType.DEAL, round: TexasHoldemRound.ANTE })
                ]
            });

            const acted = playerActed(deriveEvents(prev, next));
            // 34, 35, 36 are all new (all > 33) — no phantom playerActed from the
            // old hand's entries disappearing.
            expect(acted.map(a => a.index)).toEqual([34, 35, 36]);
        });
    });

    describe("non-player actions", () => {
        it("surfaces deal and blind posts as playerActed carrying the whole ActionDTO", () => {
            const prev = snapshot({ handNumber: 4, previousActions: [] });
            const next = snapshot({
                handNumber: 4,
                previousActions: [
                    action(34, { seat: 4, playerId: BOB, action: PlayerActionType.SMALL_BLIND, amount: "10000", round: TexasHoldemRound.ANTE }),
                    action(35, { action: PlayerActionType.BIG_BLIND, amount: "20000", round: TexasHoldemRound.ANTE }),
                    action(36, { seat: 4, playerId: BOB, action: NonPlayerActionType.DEAL, amount: "", round: TexasHoldemRound.ANTE })
                ]
            });

            const acted = playerActed(deriveEvents(prev, next));
            expect(acted.map(a => a.action)).toEqual([PlayerActionType.SMALL_BLIND, PlayerActionType.BIG_BLIND, NonPlayerActionType.DEAL]);
            // Consumers can distinguish the deal (a NonPlayerActionType) from voluntary play.
            const deal = acted.find(a => a.action === NonPlayerActionType.DEAL);
            expect(deal?.amount).toBe("");
        });
    });

    describe("handStarted", () => {
        it("emits handStarted on a handNumber advance", () => {
            const prev = snapshot({ handNumber: 3, previousActions: [action(33)] });
            const next = snapshot({ handNumber: 4, previousActions: [action(34)] });

            const started = ofType(deriveEvents(prev, next), "handStarted");
            expect(started).toHaveLength(1);
            expect(started[0].handNumber).toBe(4);
        });

        it("does not emit handStarted when the hand number is unchanged", () => {
            const prev = snapshot({ handNumber: 4, previousActions: [action(34)] });
            const next = snapshot({ handNumber: 4, previousActions: [action(34), action(35)] });
            expect(ofType(deriveEvents(prev, next), "handStarted")).toHaveLength(0);
        });
    });

    describe("roundAdvanced", () => {
        it("emits the 3 flop cards on preflop -> flop", () => {
            const prev = snapshot({ round: TexasHoldemRound.PREFLOP, communityCards: [] });
            const next = snapshot({ round: TexasHoldemRound.FLOP, communityCards: ["7C", "7H", "QC"] });

            const rounds = ofType(deriveEvents(prev, next), "roundAdvanced");
            expect(rounds).toHaveLength(1);
            expect(rounds[0]).toMatchObject({ from: TexasHoldemRound.PREFLOP, to: TexasHoldemRound.FLOP });
            expect(rounds[0].newCommunityCards).toEqual(["7C", "7H", "QC"]);
        });

        it("emits the single turn card on flop -> turn", () => {
            const prev = snapshot({ round: TexasHoldemRound.FLOP, communityCards: ["7C", "7H", "QC"] });
            const next = snapshot({ round: TexasHoldemRound.TURN, communityCards: ["7C", "7H", "QC", "8H"] });

            const rounds = ofType(deriveEvents(prev, next), "roundAdvanced");
            expect(rounds[0].newCommunityCards).toEqual(["8H"]);
        });

        it("emits the single river card on turn -> river", () => {
            const prev = snapshot({ round: TexasHoldemRound.TURN, communityCards: ["7C", "7H", "QC", "8H"] });
            const next = snapshot({ round: TexasHoldemRound.RIVER, communityCards: ["7C", "7H", "QC", "8H", "6C"] });

            const rounds = ofType(deriveEvents(prev, next), "roundAdvanced");
            expect(rounds[0].newCommunityCards).toEqual(["6C"]);
        });

        it("handles an all-in runout that jumps multiple streets in one frame", () => {
            const prev = snapshot({ round: TexasHoldemRound.PREFLOP, communityCards: [] });
            const next = snapshot({ round: TexasHoldemRound.RIVER, communityCards: ["7C", "7H", "QC", "8H", "6C"] });

            const rounds = ofType(deriveEvents(prev, next), "roundAdvanced");
            expect(rounds).toHaveLength(1);
            expect(rounds[0]).toMatchObject({ from: TexasHoldemRound.PREFLOP, to: TexasHoldemRound.RIVER });
            expect(rounds[0].newCommunityCards).toEqual(["7C", "7H", "QC", "8H", "6C"]);
        });

        it("does not emit roundAdvanced when a new hand resets end -> preflop", () => {
            const prev = snapshot({ handNumber: 3, round: TexasHoldemRound.END, communityCards: ["7C", "7H", "QC", "8H", "6C"] });
            const next = snapshot({ handNumber: 4, round: TexasHoldemRound.PREFLOP, communityCards: [] });
            expect(ofType(deriveEvents(prev, next), "roundAdvanced")).toHaveLength(0);
        });
    });

    describe("cardsRevealed", () => {
        it("emits per-seat cardsRevealed when masked X hole cards become real at showdown", () => {
            const prev = snapshot({
                players: [player(1, { holeCards: ["X", "X"] }), player(4, { address: BOB, holeCards: ["X", "X"] })]
            });
            const next = snapshot({
                round: TexasHoldemRound.SHOWDOWN,
                players: [player(1, { holeCards: ["X", "X"] }), player(4, { address: BOB, holeCards: ["5S", "2S"] })]
            });

            const revealed = ofType(deriveEvents(prev, next), "cardsRevealed");
            expect(revealed).toHaveLength(1);
            expect(revealed[0]).toEqual({ type: "cardsRevealed", seat: 4, cards: ["5S", "2S"] });
        });

        it("does not emit cardsRevealed for cards that were already visible", () => {
            const prev = snapshot({ players: [player(1, { holeCards: ["AH", "KH"] })] });
            const next = snapshot({ players: [player(1, { holeCards: ["AH", "KH"] })] });
            expect(ofType(deriveEvents(prev, next), "cardsRevealed")).toHaveLength(0);
        });
    });

    describe("cardsDealt (ui#21)", () => {
        const undealt = (seat: number, over: Partial<PlayerDTO> = {}) => player(seat, { holeCards: [], ...over });

        it("emits the seats that go from no hole cards to a masked or real hand, ascending", () => {
            const prev = snapshot({ players: [undealt(4, { address: BOB }), undealt(1)] });
            const next = snapshot({
                dealer: 1,
                players: [player(4, { address: BOB, holeCards: ["X", "X"] }), player(1, { holeCards: ["AH", "KD"] })]
            });
            const dealt = ofType(deriveEvents(prev, next), "cardsDealt");
            expect(dealt).toEqual([{ type: "cardsDealt", seats: [1, 4], dealerSeat: 1 }]);
        });

        it("also fires on a hand advance when cards were still present from the last hand", () => {
            // The engine keeps hole cards through END and clears them only at the
            // next hand's reinit, so the engine-driven hand start shows
            // "old cards → new cards" on the handStarted frame.
            const prev = snapshot({ handNumber: 3, round: TexasHoldemRound.END, players: [player(1, { holeCards: ["2C", "7D"] }), player(4, { address: BOB, holeCards: ["X", "X"] })] });
            const next = snapshot({ handNumber: 4, dealer: 4, players: [player(1, { holeCards: ["AS", "AD"] }), player(4, { address: BOB, holeCards: ["X", "X"] })] });
            const events = deriveEvents(prev, next);
            expect(ofType(events, "handStarted")).toHaveLength(1);
            expect(ofType(events, "cardsDealt")).toEqual([{ type: "cardsDealt", seats: [1, 4], dealerSeat: 4 }]);
        });

        it("emits nothing when nobody gains cards (a betting action mid-hand)", () => {
            const prev = snapshot({ previousActions: [action(1)] });
            const next = snapshot({ previousActions: [action(1), action(2, { playerId: BOB, seat: 4 })] });
            expect(ofType(deriveEvents(prev, next), "cardsDealt")).toHaveLength(0);
        });

        it("emits nothing on the first frame (late mount is not a deal)", () => {
            expect(deriveEvents(undefined, snapshot())).toEqual([]);
        });

        it("skips a seat parked WAITING_FOR_BIG_BLIND even if the snapshot carries cards for it", () => {
            const prev = snapshot({ players: [undealt(1), undealt(4, { address: BOB })] });
            const next = snapshot({
                players: [player(1, { holeCards: ["AH", "KD"] }), player(4, { address: BOB, holeCards: ["X", "X"], status: PlayerStatus.WAITING_FOR_BIG_BLIND })]
            });
            expect(ofType(deriveEvents(prev, next), "cardsDealt")).toEqual([{ type: "cardsDealt", seats: [1], dealerSeat: null }]);
        });

        it("does not deal in a seat that joined mid-hand carrying cards, but does on a new hand", () => {
            const prev = snapshot({ players: [player(1, { holeCards: ["AH", "KD"] })] });
            const joinedMidHand = snapshot({ players: [player(1, { holeCards: ["AH", "KD"] }), player(4, { address: BOB, holeCards: ["X", "X"] })] });
            expect(ofType(deriveEvents(prev, joinedMidHand), "cardsDealt")).toHaveLength(0);

            const joinedOnNewHand = snapshot({ handNumber: 2, players: [player(1, { holeCards: ["AH", "KD"] }), player(4, { address: BOB, holeCards: ["X", "X"] })] });
            expect(ofType(deriveEvents(prev, joinedOnNewHand), "cardsDealt")).toEqual([{ type: "cardsDealt", seats: [1, 4], dealerSeat: null }]);
        });

        it("reports a null dealer when the snapshot has none, and the seat otherwise", () => {
            const prev = snapshot({ players: [undealt(1)] });
            expect(ofType(deriveEvents(prev, snapshot({ players: [player(1, { holeCards: ["AH", "KD"] })] })), "cardsDealt")[0].dealerSeat).toBeNull();
            expect(ofType(deriveEvents(prev, snapshot({ dealer: 1, players: [player(1, { holeCards: ["AH", "KD"] })] })), "cardsDealt")[0].dealerSeat).toBe(1);
        });
    });

    describe("handEnded", () => {
        it("extracts winners when winners transition from empty to populated", () => {
            const winner: WinnerDTO = { address: ALICE, seat: 1, amount: "100000", cards: ["AH", "KH"], name: "Winner", description: "High Card" };
            const prev = snapshot({ winners: [] });
            const next = snapshot({ round: TexasHoldemRound.END, winners: [winner] });

            const ended = ofType(deriveEvents(prev, next), "handEnded");
            expect(ended).toHaveLength(1);
            expect(ended[0].winners).toEqual([winner]);
        });

        it("does not re-emit handEnded while winners stay populated", () => {
            const winner: WinnerDTO = { address: ALICE, seat: 1, amount: "100000", cards: undefined, name: undefined, description: undefined };
            const prev = snapshot({ round: TexasHoldemRound.END, winners: [winner] });
            const next = snapshot({ round: TexasHoldemRound.END, winners: [winner] });
            expect(ofType(deriveEvents(prev, next), "handEnded")).toHaveLength(0);
        });
    });

    describe("player join / leave", () => {
        it("emits playerJoined for a seat that appears", () => {
            const prev = snapshot({ players: [player(1)] });
            const next = snapshot({ players: [player(1), player(4, { address: BOB })] });

            const joined = ofType(deriveEvents(prev, next), "playerJoined");
            expect(joined).toEqual([{ type: "playerJoined", seat: 4, address: BOB }]);
        });

        it("emits playerLeft for a seat that disappears", () => {
            const prev = snapshot({ players: [player(1), player(4, { address: BOB })] });
            const next = snapshot({ players: [player(1)] });

            const left = ofType(deriveEvents(prev, next), "playerLeft");
            expect(left).toEqual([{ type: "playerLeft", seat: 4, address: BOB }]);
        });
    });

    describe("stackChanged", () => {
        it("emits stackChanged per seat whose stack string changes", () => {
            const prev = snapshot({ players: [player(1, { stack: "1000000" }), player(4, { address: BOB, stack: "1000000" })] });
            const next = snapshot({ players: [player(1, { stack: "980000" }), player(4, { address: BOB, stack: "1000000" })] });

            const changed = ofType(deriveEvents(prev, next), "stackChanged");
            expect(changed).toEqual([{ type: "stackChanged", seat: 1, from: "1000000", to: "980000" }]);
        });
    });

    describe("regressed snapshot (Commandment 7)", () => {
        it("throws RegressedSnapshotError when same-hand indices go backwards", () => {
            const prev = snapshot({ handNumber: 4, previousActions: [action(40), action(41)] });
            const next = snapshot({ handNumber: 4, previousActions: [action(38), action(39)] });

            expect(() => deriveEvents(prev, next)).toThrow(RegressedSnapshotError);
        });

        it("does NOT treat a hand advance with continuing indices as a regression", () => {
            const prev = snapshot({ handNumber: 4, previousActions: [action(41)] });
            const next = snapshot({ handNumber: 5, previousActions: [action(42)] });
            expect(() => deriveEvents(prev, next)).not.toThrow();
        });
    });
});
