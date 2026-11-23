import { expandFrames, runoutBeats } from "./expandFrames";
import { equityHands, shouldShowAllInEquity } from "../utils/allInEquity";
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

    describe("betting is closed on every beat (ui#968)", () => {
        // Production fingerprint (Texas HODL SNG 0xaafb…e1db, hands 10 & 12):
        // seat 1 bets all-in, seat 4 calls all-in for less, and seat 7 — still
        // to act — folds. The fold closes the betting, so the engine sends the
        // fold, the runout and the winner in ONE snapshot. No beat of the
        // expansion may keep prev's turn pointer: the seat it names has folded.
        const CAROL = "b521qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq968";
        const callLegal = [{ action: PlayerActionType.CALL, min: "900", max: "900", index: 301 }];

        const threeWayFlop = snapshot({
            round: TexasHoldemRound.FLOP,
            communityCards: BOARD.slice(0, 3),
            previousActions: [action(10)],
            actionCount: 11,
            nextToAct: 7,
            legalActions: callLegal,
            players: [
                player(1, { status: PlayerStatus.ALL_IN }),
                player(4, { address: BOB, status: PlayerStatus.ALL_IN }),
                player(7, { address: CAROL, legalActions: callLegal })
            ]
        });

        const foldClosesIt = runoutResult({
            previousActions: [action(10), action(11, { seat: 7, playerId: CAROL, action: PlayerActionType.FOLD })],
            actionCount: 12,
            nextToAct: -1,
            legalActions: [],
            players: [
                player(1, { status: PlayerStatus.SHOWING, holeCards: ["AH", "AD"], stack: "2000000" }),
                player(4, { address: BOB, status: PlayerStatus.SHOWING, holeCards: ["KS", "KC"], stack: "0" }),
                player(7, { address: CAROL, status: PlayerStatus.FOLDED })
            ]
        });

        it("every sub-frame carries next's turn pointer, never prev's", () => {
            const frames = expandFrames(threeWayFlop, foldClosesIt);
            expect(frames.length).toBeGreaterThanOrEqual(3);
            for (const frame of frames) {
                expect(frame.nextToAct).toBe(-1);
            }
        });

        it("every sub-frame carries next's legal actions, table-level and per seat", () => {
            const frames = expandFrames(threeWayFlop, foldClosesIt);
            for (const frame of frames) {
                expect(frame.legalActions).toEqual([]);
                expect(frame.players.find(p => p.seat === 7)?.legalActions).toEqual([]);
            }
        });

        it("the seat whose fold closed the betting is folded from the first beat", () => {
            const frames = expandFrames(threeWayFlop, foldClosesIt);
            for (const frame of frames) {
                expect(frame.players.find(p => p.seat === 7)?.status).toBe(PlayerStatus.FOLDED);
            }
        });

        it("closing the betting leaks no result: stacks stay pre-payout until the final frame", () => {
            const frames = expandFrames(threeWayFlop, foldClosesIt);
            for (const frame of frames.slice(0, -1)) {
                expect(frame.players.find(p => p.seat === 1)?.stack).toBe("1000000");
                expect(frame.winners).toEqual([]);
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

        it("turns a SHOWING seat face up from the reveal beat on (ui#873)", () => {
            // The seat draws an opponent's cards only while it is SHOWING.
            const showingNext = runoutResult({
                players: [
                    player(1, { holeCards: ["AH", "AD"], stack: "2000000" }),
                    player(4, { address: BOB, holeCards: ["KS", "KC"], stack: "0", status: PlayerStatus.SHOWING })
                ]
            });
            const frames = expandFrames(maskedPrev, showingNext);
            for (const frame of frames.slice(0, -1)) {
                expect(frame.players.find(p => p.seat === 4)?.status).toBe(PlayerStatus.SHOWING);
                // Only the cards and status move early; the stack stays pre-payout.
                expect(frame.players.find(p => p.seat === 4)?.stack).toBe(maskedPrev.players[1].stack);
            }
        });

        it("carries cardsShown with the reveal, so a busted loser is tabled early (poker-vm#2758)", () => {
            // A player who busts on the runout is BUSTED in next, not SHOWING;
            // the engine's cardsShown is what tables their hand.
            const bustedNext = runoutResult({
                players: [
                    player(1, { holeCards: ["AH", "AD"], stack: "2000000", status: PlayerStatus.SHOWING, cardsShown: true }),
                    player(4, { address: BOB, holeCards: ["KS", "KC"], stack: "0", status: PlayerStatus.BUSTED, cardsShown: true })
                ]
            });
            const frames = expandFrames(maskedPrev, bustedNext);
            for (const frame of frames.slice(0, -1)) {
                const bob = frame.players.find(p => p.seat === 4);
                expect(bob?.holeCards).toEqual(["KS", "KC"]);
                expect(bob?.cardsShown).toBe(true);
                // BUSTED + cardsShown is still in the runout, so the street
                // frames table the hand as SHOWING. The result frame keeps BUSTED.
                expect(bob?.status).toBe(PlayerStatus.SHOWING);
            }
            expect(frames[frames.length - 1].players.find(p => p.seat === 4)?.status).toBe(PlayerStatus.BUSTED);
        });

        it("marks a face-up last caller SHOWING for the runout (ui#210)", () => {
            const frames = expandFrames(maskedPrev, revealedNext);
            for (const frame of frames.slice(0, -1)) {
                expect(frame.players.find(p => p.seat === 4)?.status).toBe(PlayerStatus.SHOWING);
            }
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

describe("single-street run-outs (ui#873)", () => {
    const turn = () => snapshot({ round: TexasHoldemRound.TURN, communityCards: BOARD.slice(0, 4), previousActions: [action(10)], actionCount: 11 });
    const SPLIT = { splitSingleStreetRunout: true };

    it("stays whole without the option (cash keeps the single-frame path)", () => {
        const next = runoutResult();
        expect(expandFrames(turn(), next)).toEqual([next]);
    });

    it("splits a turn all-in into river, then result, when asked", () => {
        const next = runoutResult();
        const frames = expandFrames(turn(), next, SPLIT);
        expect(frames.map(f => f.communityCards.length)).toEqual([5, 5]);
        expect(frames[0].round).toBe(TexasHoldemRound.RIVER);
        expect(frames[0].winners).toEqual([]);
        expect(frames[1]).toBe(next);
    });

    it("never splits an ordinary street advance, even when asked", () => {
        const next = snapshot({ round: TexasHoldemRound.RIVER, communityCards: [...BOARD] });
        expect(expandFrames(turn(), next, SPLIT)).toEqual([next]);
    });
});

describe("all-in equity on runout frames (ui#210)", () => {
    const CAROL = "b521carol000000000000000000000000000210";
    const DAVE = "b521dave0000000000000000000000000000210";
    const HOLE = {
        1: ["AH", "AD"],
        2: ["KS", "KC"],
        4: ["QS", "QC"]
    } as const;

    function runout(start: "preflop" | "flop" | "turn") {
        const communityCards = start === "preflop" ? [] : start === "flop" ? BOARD.slice(0, 3) : BOARD.slice(0, 4);
        const round = start === "preflop"
            ? TexasHoldemRound.PREFLOP
            : start === "flop"
                ? TexasHoldemRound.FLOP
                : TexasHoldemRound.TURN;
        const masked = ["X", "X"];
        const prev = snapshot({
            round,
            communityCards,
            nextToAct: 4,
            players: [
                player(1, { status: PlayerStatus.ALL_IN, holeCards: masked }),
                player(2, { address: CAROL, status: PlayerStatus.ACTIVE, holeCards: masked }),
                player(4, { address: BOB, status: PlayerStatus.ACTIVE, holeCards: masked }),
                player(7, { address: DAVE, status: PlayerStatus.ACTIVE, holeCards: masked })
            ]
        });
        const next = runoutResult({
            nextToAct: -1,
            legalActions: [],
            players: [
                player(1, { status: PlayerStatus.BUSTED, cardsShown: true, holeCards: [...HOLE[1]], stack: "0" }),
                player(2, { address: CAROL, status: PlayerStatus.BUSTED, cardsShown: true, holeCards: [...HOLE[2]], stack: "0" }),
                player(4, { address: BOB, status: PlayerStatus.ACTIVE, cardsShown: true, holeCards: [...HOLE[4]], stack: "5000000" }),
                player(7, { address: DAVE, status: PlayerStatus.FOLDED, holeCards: ["7H", "2D"], stack: "1000000" })
            ]
        });
        const options = start === "turn" ? { splitSingleStreetRunout: true } : undefined;
        return expandFrames(prev, next, options);
    }

    it.each(["preflop", "flop", "turn"] as const)(
        "a %s tournament runout shows win%% on every street and leaves the fold out",
        start => {
            const frames = runout(start);
            expect(frames.length).toBeGreaterThanOrEqual(2);
            const streets = frames.slice(0, -1);
            expect(streets.length).toBeGreaterThanOrEqual(1);

            for (const frame of streets) {
                expect(frame.nextToAct).toBe(-1);
                expect(frame.players.find(p => p.seat === 7)?.status).toBe(PlayerStatus.FOLDED);
                // Already all-in stays all-in. The ACTIVE caller and the ACTIVE
                // seat that busts are both painted SHOWING while the board runs out.
                expect(frame.players.find(p => p.seat === 1)?.status).toBe(PlayerStatus.ALL_IN);
                expect(frame.players.find(p => p.seat === 2)?.status).toBe(PlayerStatus.SHOWING);
                expect(frame.players.find(p => p.seat === 4)?.status).toBe(PlayerStatus.SHOWING);
                expect(shouldShowAllInEquity({
                    players: frame.players,
                    round: frame.round,
                    nextToAct: frame.nextToAct,
                    holeCount: 2
                })).toBe(true);
                expect(equityHands(frame.players, 2).map(hand => hand.seat).sort()).toEqual([1, 2, 4]);
            }

            const result = frames[frames.length - 1];
            expect(result.round).toBe(TexasHoldemRound.END);
            expect(result.players.find(p => p.seat === 1)?.status).toBe(PlayerStatus.BUSTED);
            expect(result.players.find(p => p.seat === 4)?.status).toBe(PlayerStatus.ACTIVE);
            expect(shouldShowAllInEquity({
                players: result.players,
                round: result.round,
                nextToAct: result.nextToAct,
                holeCount: 2
            })).toBe(true);
            expect(equityHands(result.players, 2).map(hand => hand.seat)).not.toContain(7);
        }
    );
});

describe("runoutBeats (ui#873)", () => {
    it("names nothing when nothing was expanded", () => {
        const next = runoutResult();
        expect(runoutBeats(preflopAllIn(), [next])).toEqual([undefined]);
        expect(runoutBeats(undefined, [next])).toEqual([undefined]);
    });

    it("names a preflop run-out's streets and its result", () => {
        const prev = preflopAllIn();
        const frames = expandFrames(prev, runoutResult());
        const beats = runoutBeats(prev, frames);
        expect(beats[beats.length - 1]).toBe("result");
        expect(beats.filter(b => b !== "reveal")).toEqual(["flop", "turn", "river", "result"]);
    });

    it("names the face-up frame `reveal` even when the run-out starts on the flop", () => {
        const prev = snapshot({
            round: TexasHoldemRound.FLOP,
            communityCards: BOARD.slice(0, 3),
            players: [player(1, { holeCards: ["X", "X"] }), player(4, { address: BOB, holeCards: ["X", "X"] })]
        });
        const next = runoutResult({
            players: [player(1, { holeCards: ["AH", "AD"] }), player(4, { address: BOB, holeCards: ["KS", "KC"] })]
        });
        const frames = expandFrames(prev, next);
        expect(runoutBeats(prev, frames)).toEqual(["reveal", "turn", "river", "result"]);
    });
});
