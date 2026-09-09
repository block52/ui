import { expandFrames } from "./expandFrames";
import { deriveEvents } from "./deriveEvents";
import { communityCardStagger } from "./decorators/communityCardStagger";
import { DEFAULT_DECORATION } from "./types";
import type { GameEvent, GameStreamItem } from "./types";
import {
    TexasHoldemStateDTO,
    ActionDTO,
    PlayerDTO,
    WinnerDTO,
    GameOptionsDTO,
    PlayerActionType,
    TexasHoldemRound,
    PlayerStatus
} from "@block52/poker-vm-sdk";

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

const BOARD = ["AS", "KD", "7C", "2H", "9S"];

function action(index: number, over: Partial<ActionDTO> = {}): ActionDTO {
    return {
        playerId: ALICE,
        seat: 1,
        action: PlayerActionType.CALL,
        amount: "1000000",
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

const WINNER: WinnerDTO = { address: ALICE, amount: "2000000" } as WinnerDTO;

/** Preflop, two players all-in, nothing on the board yet. */
function preflopAllIn(over: Partial<TexasHoldemStateDTO> = {}): TexasHoldemStateDTO {
    return snapshot({
        round: TexasHoldemRound.PREFLOP,
        communityCards: [],
        previousActions: [action(10)],
        actionCount: 11,
        ...over
    });
}

/** The single frame the engine sends back: whole runout + settlement. */
function runoutResult(over: Partial<TexasHoldemStateDTO> = {}): TexasHoldemStateDTO {
    return snapshot({
        round: TexasHoldemRound.END,
        communityCards: [...BOARD],
        previousActions: [action(10), action(11, { seat: 4, playerId: BOB })],
        actionCount: 12,
        players: [player(1, { stack: "2000000" }), player(4, { address: BOB, stack: "0" })],
        winners: [WINNER],
        ...over
    });
}

describe("expandFrames", () => {
    describe("passthrough — expansion must not apply", () => {
        it("returns [next] when there is no previous snapshot", () => {
            const next = runoutResult();
            expect(expandFrames(undefined, next)).toEqual([next]);
        });

        it("returns [next] across a hand boundary", () => {
            const prev = preflopAllIn();
            const next = runoutResult({ handNumber: 2 });
            expect(expandFrames(prev, next)).toEqual([next]);
        });

        it("returns [next] for a single-street advance (preflop -> flop)", () => {
            const prev = preflopAllIn();
            const next = snapshot({ round: TexasHoldemRound.FLOP, communityCards: BOARD.slice(0, 3) });
            expect(expandFrames(prev, next)).toEqual([next]);
        });

        it("returns [next] for a single-street advance (flop -> turn)", () => {
            const prev = snapshot({ round: TexasHoldemRound.FLOP, communityCards: BOARD.slice(0, 3) });
            const next = snapshot({ round: TexasHoldemRound.TURN, communityCards: BOARD.slice(0, 4) });
            expect(expandFrames(prev, next)).toEqual([next]);
        });

        it("returns [next] when the round jumps but no cards are dealt (fold to showdown)", () => {
            const prev = preflopAllIn();
            const next = snapshot({
                round: TexasHoldemRound.END,
                communityCards: [],
                winners: [WINNER]
            });
            expect(expandFrames(prev, next)).toEqual([next]);
        });

        it("returns [next] for a board length off the engine's schedule", () => {
            // Two cards is not a street boundary: only the flop's boardSize of 3
            // could match, and it exceeds nextBoard. Decline rather than guess.
            const prev = preflopAllIn();
            const next = snapshot({ round: TexasHoldemRound.FLOP, communityCards: BOARD.slice(0, 2) });
            expect(expandFrames(prev, next)).toEqual([next]);
        });

        it("returns [next] when the board did not grow", () => {
            const prev = snapshot({ round: TexasHoldemRound.RIVER, communityCards: [...BOARD] });
            const next = snapshot({ round: TexasHoldemRound.END, communityCards: [...BOARD], winners: [WINNER] });
            expect(expandFrames(prev, next)).toEqual([next]);
        });
    });

    describe("multi-street expansion", () => {
        it("splits a preflop runout into flop, turn, river, result", () => {
            const prev = preflopAllIn();
            const next = runoutResult();

            const frames = expandFrames(prev, next);

            expect(frames).toHaveLength(4);
            expect(frames.map(f => f.round)).toEqual([
                TexasHoldemRound.FLOP,
                TexasHoldemRound.TURN,
                TexasHoldemRound.RIVER,
                TexasHoldemRound.END
            ]);
            expect(frames.map(f => f.communityCards.length)).toEqual([3, 4, 5, 5]);
        });

        it("splits a flop runout into turn, river, result", () => {
            const prev = snapshot({
                round: TexasHoldemRound.FLOP,
                communityCards: BOARD.slice(0, 3),
                previousActions: [action(10)]
            });
            const next = runoutResult();

            const frames = expandFrames(prev, next);

            expect(frames).toHaveLength(3);
            expect(frames.map(f => f.round)).toEqual([TexasHoldemRound.TURN, TexasHoldemRound.RIVER, TexasHoldemRound.END]);
            expect(frames.map(f => f.communityCards.length)).toEqual([4, 5, 5]);
        });

        it("carries the real board cards, in order, onto each street", () => {
            const frames = expandFrames(preflopAllIn(), runoutResult());
            expect(frames[0].communityCards).toEqual(["AS", "KD", "7C"]);
            expect(frames[1].communityCards).toEqual(["AS", "KD", "7C", "2H"]);
            expect(frames[2].communityCards).toEqual([...BOARD]);
        });

        it("returns the real snapshot as the final frame, by identity", () => {
            const next = runoutResult();
            const frames = expandFrames(preflopAllIn(), next);
            expect(frames[frames.length - 1]).toBe(next);
        });
    });

    describe("the result must not leak onto intermediate frames", () => {
        it("keeps winners empty until the final frame", () => {
            const frames = expandFrames(preflopAllIn(), runoutResult());
            const intermediates = frames.slice(0, -1);
            expect(intermediates.every(f => f.winners.length === 0)).toBe(true);
            expect(frames[frames.length - 1].winners).toEqual([WINNER]);
        });

        it("keeps pre-showdown stacks until the final frame", () => {
            const frames = expandFrames(preflopAllIn(), runoutResult());
            const intermediates = frames.slice(0, -1);
            expect(intermediates.every(f => f.players.every(p => p.stack === "1000000"))).toBe(true);
            expect(frames[frames.length - 1].players.map(p => p.stack)).toEqual(["2000000", "0"]);
        });
    });

    describe("the triggering action rides the first beat", () => {
        it("carries previousActions and actionCount onto every intermediate", () => {
            const next = runoutResult();
            const frames = expandFrames(preflopAllIn(), next);
            for (const frame of frames) {
                expect(frame.previousActions).toEqual(next.previousActions);
                expect(frame.actionCount).toBe(next.actionCount);
            }
        });
    });

    describe("hole-card reveal beat", () => {
        const maskedPrev = preflopAllIn({
            players: [player(1, { holeCards: ["AH", "AD"] }), player(4, { address: BOB, holeCards: ["X", "X"] })]
        });
        const revealedNext = runoutResult({
            players: [
                player(1, { holeCards: ["AH", "AD"], stack: "2000000" }),
                player(4, { address: BOB, holeCards: ["KS", "KC"], stack: "0" })
            ]
        });

        it("prepends a reveal frame when a seat turns its hand face up", () => {
            const frames = expandFrames(maskedPrev, revealedNext);

            expect(frames).toHaveLength(5);
            // The reveal beat sits on the PREVIOUS street with the PREVIOUS board.
            expect(frames[0].round).toBe(TexasHoldemRound.PREFLOP);
            expect(frames[0].communityCards).toEqual([]);
            expect(frames[0].players.find(p => p.seat === 4)?.holeCards).toEqual(["KS", "KC"]);
        });

        it("keeps revealed cards face up for the rest of the runout", () => {
            // Regression guard: applying the reveal to only the first frame would
            // flip seat 4 back to ["X","X"] on the flop.
            const frames = expandFrames(maskedPrev, revealedNext);
            for (const frame of frames) {
                expect(frame.players.find(p => p.seat === 4)?.holeCards).toEqual(["KS", "KC"]);
            }
        });

        it("emits no reveal frame when nothing was revealed", () => {
            const frames = expandFrames(preflopAllIn(), runoutResult());
            expect(frames).toHaveLength(4);
            expect(frames[0].round).toBe(TexasHoldemRound.FLOP);
        });

        it("does not disturb a seat that was already face up", () => {
            const frames = expandFrames(maskedPrev, revealedNext);
            for (const frame of frames) {
                expect(frame.players.find(p => p.seat === 1)?.holeCards).toEqual(["AH", "AD"]);
            }
        });
    });

    describe("purity", () => {
        it("mutates neither input", () => {
            const prev = preflopAllIn();
            const next = runoutResult();
            const prevCopy = JSON.parse(JSON.stringify(prev));
            const nextCopy = JSON.parse(JSON.stringify(next));

            expandFrames(prev, next);

            expect(prev).toEqual(prevCopy);
            expect(next).toEqual(nextCopy);
        });
    });
});

/**
 * The point of the whole design (plan §2.4): because each frame is derived
 * against its PREDECESSOR frame, the existing decorators need no changes.
 */
describe("expandFrames + deriveEvents integration", () => {
    /** Walk the expanded chain the way GameMessageBus.ingest will. */
    function deriveChain(prev: TexasHoldemStateDTO, next: TexasHoldemStateDTO): GameEvent[][] {
        const frames = expandFrames(prev, next);
        const perFrame: GameEvent[][] = [];
        let previous = prev;
        for (const frame of frames) {
            perFrame.push(deriveEvents(previous, frame));
            previous = frame;
        }
        return perFrame;
    }

    it("yields one roundAdvanced per street, with 3/1/1 new cards", () => {
        const perFrame = deriveChain(preflopAllIn(), runoutResult());

        const advances = perFrame.flat().filter(e => e.type === "roundAdvanced");
        // The trailing 0 is the final frame's RIVER -> END advance, which deals
        // nothing; communityCardStagger skips it (it requires hasElements).
        expect(advances.map(e => (e.type === "roundAdvanced" ? e.newCommunityCards.length : -1))).toEqual([3, 1, 1, 0]);
        expect(advances.map(e => (e.type === "roundAdvanced" ? e.to : null))).toEqual([
            TexasHoldemRound.FLOP,
            TexasHoldemRound.TURN,
            TexasHoldemRound.RIVER,
            // the final frame still advances RIVER -> END, dealing nothing
            TexasHoldemRound.END
        ]);
    });

    it("emits handEnded only on the final frame", () => {
        const perFrame = deriveChain(preflopAllIn(), runoutResult());

        const endedAt = perFrame.map(events => events.some(e => e.type === "handEnded"));
        expect(endedAt).toEqual([false, false, false, true]);
    });

    it("emits the triggering playerActed on the first beat, not after the river", () => {
        const perFrame = deriveChain(preflopAllIn(), runoutResult());

        const actedAt = perFrame.map(events => events.filter(e => e.type === "playerActed").length);
        expect(actedAt).toEqual([1, 0, 0, 0]);
    });

    it("emits stackChanged only on the final frame", () => {
        const perFrame = deriveChain(preflopAllIn(), runoutResult());

        const stacksAt = perFrame.map(events => events.some(e => e.type === "stackChanged"));
        expect(stacksAt).toEqual([false, false, false, true]);
    });

    it("never derives a regressed snapshot across the chain", () => {
        expect(() => deriveChain(preflopAllIn(), runoutResult())).not.toThrow();
    });

    it("gives communityCardStagger a hint of at most MAX_STREET_CARDS per commit", () => {
        // Today a runout hands the decorator all 5 cards at once, which overruns
        // the DEAL_CARDS_ACK_TIMEOUT_MS budget (sized for 3). After expansion no
        // frame carries more than a single street.
        const perFrame = deriveChain(preflopAllIn(), runoutResult());

        const hintSizes = perFrame
            .map(events => communityCardStagger({ events, decoration: { ...DEFAULT_DECORATION } } as GameStreamItem, undefined))
            .flatMap(patch => patch.animations ?? [])
            .map(hint => hint.cards?.length ?? 0);

        expect(hintSizes).toEqual([3, 1, 1]);
        expect(Math.max(...hintSizes)).toBeLessThanOrEqual(3);
    });
});
