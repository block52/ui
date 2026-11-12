import { ActionDTO, PlayerActionType, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { CLOSING_BET_FLIGHT_MS, CLOSING_BET_HOLD_MS } from "../bus/timing";
import { applyPotHoldback, closingBetPhase, closingBetsCollected, deriveClosingBets, type ClosingBetView } from "./closingBets";
import { getClosingClock, resetClosingClock, syncClosingClock } from "../hooks/player/closingBetClock";

const ALICE = "alice";
const BOB = "bob";
const CAROL = "carol";

function act(index: number, playerId: string, seat: number, action: PlayerActionType, amount: string | undefined, round: TexasHoldemRound): ActionDTO {
    return { playerId, seat, action, amount: amount ?? "", round, index, timestamp: index };
}

function seat(address: string, seatNumber: number, status: PlayerStatus, sumOfBets: string) {
    return { address, seat: seatNumber, status, sumOfBets };
}

describe("closing bets (block52/ui#975)", () => {
    describe("all-in plus call, preflop runout", () => {
        const actions = [
            act(1, BOB, 2, PlayerActionType.BIG_BLIND, "200", TexasHoldemRound.ANTE),
            act(2, ALICE, 1, PlayerActionType.ALL_IN, "2000", TexasHoldemRound.PREFLOP),
            act(3, BOB, 2, PlayerActionType.CALL, "1700", TexasHoldemRound.PREFLOP)
        ];
        const players = [
            seat(ALICE, 1, PlayerStatus.SHOWING, "2000"),
            seat(BOB, 2, PlayerStatus.SHOWING, "200")
        ];

        it("draws both street totals on a runout sub-frame and keeps the pot at the pre-call amount", () => {
            const view = deriveClosingBets({
                round: TexasHoldemRound.FLOP,
                nextToAct: -1,
                winners: [],
                players,
                previousActions: actions
            });

            expect(view.collectedIntoPot).toBe(false);
            expect(view.draws.map(draw => [draw.seat, draw.amount, draw.action.action])).toEqual([
                [1, "2000", PlayerActionType.ALL_IN],
                [2, "1900", PlayerActionType.CALL]
            ]);
            // 2,200 already in the pot (Alice's all-in and Bob's blind). Bob's 1,700 call is not.
            expect(view.potHoldback).toBe("2200");
            const pot = applyPotHoldback(["0"], "2200", view.potHoldback);
            const chips = view.draws.reduce((sum, draw) => sum + BigInt(draw.amount), 0n);
            expect(BigInt(pot.totalPot ?? "0") + chips).toBe(3900n);
        });

        it("on the result beat the whole street is in the pot, so the holdback is the chips themselves", () => {
            const view = deriveClosingBets({
                round: TexasHoldemRound.END,
                nextToAct: -1,
                winners: [{ address: ALICE }],
                players: players.map(player => ({ ...player, sumOfBets: "0" })),
                previousActions: actions
            });

            expect(view.collectedIntoPot).toBe(true);
            expect(view.potHoldback).toBe("3900");
            const pot = applyPotHoldback(["3900"], "3900", view.potHoldback);
            expect(pot.totalPot).toBe("0");
            expect(pot.pots).toEqual(["0"]);
        });

        it("leaves nextToAct cleared: a runout sub-frame is not treated as a live street", () => {
            expect(closingBetsCollected(TexasHoldemRound.FLOP, TexasHoldemRound.PREFLOP, -1, [])).toBe(false);
            expect(closingBetsCollected(TexasHoldemRound.RIVER, TexasHoldemRound.PREFLOP, -1, [])).toBe(false);
            expect(closingBetsCollected(TexasHoldemRound.END, TexasHoldemRound.PREFLOP, -1, [{ address: ALICE }])).toBe(true);
        });
    });

    describe("flop call that deals the turn", () => {
        it("draws the flop street and holds the pot back to the amount from before the flop bets", () => {
            const view = deriveClosingBets({
                round: TexasHoldemRound.TURN,
                nextToAct: 1,
                winners: [],
                players: [
                    seat(ALICE, 1, PlayerStatus.ACTIVE, "0"),
                    seat(BOB, 2, PlayerStatus.ACTIVE, "0")
                ],
                previousActions: [
                    act(1, ALICE, 1, PlayerActionType.BET, "600", TexasHoldemRound.FLOP),
                    act(2, BOB, 2, PlayerActionType.CALL, "600", TexasHoldemRound.FLOP)
                ]
            });

            expect(view.collectedIntoPot).toBe(true);
            expect(view.draws.map(draw => [draw.seat, draw.amount])).toEqual([
                [1, "600"],
                [2, "600"]
            ]);
            expect(view.draws[1].action.action).toBe(PlayerActionType.CALL);
            const pot = applyPotHoldback(["1600"], "1600", view.potHoldback);
            expect(pot).toEqual({ pots: ["400"], totalPot: "400" });
            const chips = 600n + 600n;
            expect(BigInt(pot.totalPot ?? "0") + chips).toBe(1600n);
        });
    });

    describe("multi-way with a side pot", () => {
        const actions = [
            act(1, ALICE, 1, PlayerActionType.ALL_IN, "500", TexasHoldemRound.FLOP),
            act(2, BOB, 2, PlayerActionType.ALL_IN, "1500", TexasHoldemRound.FLOP),
            act(3, CAROL, 3, PlayerActionType.CALL, "1500", TexasHoldemRound.FLOP)
        ];

        it("draws every seat's street total and takes the holdback off the side pot first", () => {
            const view = deriveClosingBets({
                round: TexasHoldemRound.TURN,
                nextToAct: 3,
                winners: [],
                players: [
                    seat(ALICE, 1, PlayerStatus.ALL_IN, "0"),
                    seat(BOB, 2, PlayerStatus.ALL_IN, "0"),
                    seat(CAROL, 3, PlayerStatus.ACTIVE, "0")
                ],
                previousActions: actions
            });

            expect(view.draws.map(draw => [draw.seat, draw.amount])).toEqual([
                [1, "500"],
                [2, "1500"],
                [3, "1500"]
            ]);
            // Main 1,500 (500 matched three ways) and side 2,000 (the extra 1,000 matched twice).
            const pot = applyPotHoldback(["1500", "2000"], "3500", view.potHoldback);
            expect(view.potHoldback).toBe("3500");
            expect(pot).toEqual({ pots: ["0", "0"], totalPot: "0" });
        });

        it("does not invent a chip for a seat whose closing action has no amount", () => {
            const view = deriveClosingBets({
                round: TexasHoldemRound.TURN,
                nextToAct: 3,
                winners: [],
                players: [
                    seat(ALICE, 1, PlayerStatus.ALL_IN, "0"),
                    seat(BOB, 2, PlayerStatus.ALL_IN, "0"),
                    seat(CAROL, 3, PlayerStatus.ACTIVE, "0")
                ],
                previousActions: [
                    actions[0],
                    actions[1],
                    act(3, CAROL, 3, PlayerActionType.CALL, undefined, TexasHoldemRound.FLOP)
                ]
            });

            expect(view.draws.map(draw => draw.seat)).toEqual([1, 2]);
            expect(view.potHoldback).toBe("2000");
            expect(view.draws.some(draw => draw.seat === 3)).toBe(false);
        });
    });

    describe("no amount in previousActions", () => {
        it("draws nothing and does not change the pot", () => {
            const view = deriveClosingBets({
                round: TexasHoldemRound.TURN,
                nextToAct: 1,
                winners: [],
                players: [seat(BOB, 2, PlayerStatus.ACTIVE, "0")],
                previousActions: [act(1, BOB, 2, PlayerActionType.CALL, "", TexasHoldemRound.FLOP)]
            });

            expect(view.draws).toEqual([]);
            expect(view.potHoldback).toBe("0");
            expect(view.key).toBe("");
            expect(applyPotHoldback(["1600"], "1600", view.potHoldback)).toEqual({ pots: ["1600"], totalPot: "1600" });
        });
    });

    it("leaves an in-progress street on the normal chip path", () => {
        const view = deriveClosingBets({
            round: TexasHoldemRound.FLOP,
            nextToAct: 2,
            winners: [],
            players: [seat(ALICE, 1, PlayerStatus.ACTIVE, "600")],
            previousActions: [act(1, ALICE, 1, PlayerActionType.BET, "600", TexasHoldemRound.FLOP)]
        });
        expect(view.draws).toEqual([]);
    });

    describe("collect timing", () => {
        const view: ClosingBetView = {
            draws: [{ address: BOB, seat: 2, amount: "600", action: act(2, BOB, 2, PlayerActionType.CALL, "600", TexasHoldemRound.FLOP) }],
            potHoldback: "600",
            collectedIntoPot: true,
            key: "flop:2"
        };

        it("holds a collected street, then flies the chips into the pot", () => {
            const at = 5_000;
            expect(closingBetPhase(view, { key: "flop:2", at, collectAt: null, now: at })).toBe("shown");
            expect(closingBetPhase(view, { key: "flop:2", at, collectAt: null, now: at + CLOSING_BET_HOLD_MS - 1 })).toBe("shown");
            expect(closingBetPhase(view, { key: "flop:2", at, collectAt: null, now: at + CLOSING_BET_HOLD_MS })).toBe("collecting");
            expect(closingBetPhase(view, { key: "flop:2", at, collectAt: null, now: at + CLOSING_BET_HOLD_MS + CLOSING_BET_FLIGHT_MS })).toBe("off");
        });

        it("keeps chips up through a runout and flies them when the result beat sets collectAt", () => {
            const open = { ...view, collectedIntoPot: false };
            expect(closingBetPhase(open, { key: "flop:2", at: Number.NEGATIVE_INFINITY, collectAt: null, now: 9_000 })).toBe("shown");
            expect(closingBetPhase(view, { key: "flop:2", at: 1_000, collectAt: 9_000, now: 9_000 })).toBe("collecting");
            expect(closingBetPhase(view, { key: "flop:2", at: 1_000, collectAt: 9_000, now: 9_000 + CLOSING_BET_FLIGHT_MS })).toBe("off");
        });

        it("does not replay a collected street that was already on screen", () => {
            expect(closingBetPhase(view, { key: "flop:2", at: Number.NEGATIVE_INFINITY, collectAt: null, now: 9_000 })).toBe("off");
        });

        it("runs the hold and the flight off one clock", () => {
            jest.useFakeTimers();
            jest.setSystemTime(10_000);
            resetClosingClock();
            syncClosingClock("earlier", false);
            syncClosingClock(view.key, true);
            expect(closingBetPhase(view, getClosingClock())).toBe("shown");
            jest.advanceTimersByTime(CLOSING_BET_HOLD_MS);
            expect(closingBetPhase(view, getClosingClock())).toBe("collecting");
            jest.advanceTimersByTime(CLOSING_BET_FLIGHT_MS);
            expect(closingBetPhase(view, getClosingClock())).toBe("off");
            jest.useRealTimers();
            resetClosingClock();
        });
    });
});
