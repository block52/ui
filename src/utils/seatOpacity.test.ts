import { PlayerStatus } from "@block52/poker-vm-sdk";
import { getSeatOpacityClass, SEAT_OPACITY } from "./seatOpacity";

describe("getSeatOpacityClass", () => {
    describe("when a winner exists", () => {
        it("returns FULL for the winning seat", () => {
            expect(getSeatOpacityClass({ status: PlayerStatus.ACTIVE, hasWinner: true, isWinner: true })).toBe(SEAT_OPACITY.FULL);
        });

        it("returns LOST for a non-winning seat", () => {
            expect(getSeatOpacityClass({ status: PlayerStatus.ACTIVE, hasWinner: true, isWinner: false })).toBe(SEAT_OPACITY.LOST);
        });

        it("prioritizes the winner branch over status (a folded winner is FULL)", () => {
            expect(getSeatOpacityClass({ status: PlayerStatus.FOLDED, hasWinner: true, isWinner: true })).toBe(SEAT_OPACITY.FULL);
        });

        it("prioritizes the winner branch over status (an idle non-winner is LOST, not IDLE)", () => {
            expect(getSeatOpacityClass({ status: PlayerStatus.SITTING_OUT, hasWinner: true, isWinner: false })).toBe(SEAT_OPACITY.LOST);
        });
    });

    describe("when no winner exists", () => {
        it.each([PlayerStatus.SEATED, PlayerStatus.SITTING_OUT, PlayerStatus.SITTING_IN, PlayerStatus.BUSTED])(
            "returns IDLE for seated-but-not-in-hand status %s",
            status => {
                expect(getSeatOpacityClass({ status, hasWinner: false, isWinner: false })).toBe(SEAT_OPACITY.IDLE);
            }
        );

        it("returns FOLDED for a folded player", () => {
            expect(getSeatOpacityClass({ status: PlayerStatus.FOLDED, hasWinner: false, isWinner: false })).toBe(SEAT_OPACITY.FOLDED);
        });

        it.each([PlayerStatus.ACTIVE, PlayerStatus.ALL_IN, PlayerStatus.WAITING_FOR_BIG_BLIND, PlayerStatus.SHOWING])(
            "returns FULL for in-hand status %s",
            status => {
                expect(getSeatOpacityClass({ status, hasWinner: false, isWinner: false })).toBe(SEAT_OPACITY.FULL);
            }
        );

        it("returns FULL for an undefined status", () => {
            expect(getSeatOpacityClass({ status: undefined, hasWinner: false, isWinner: false })).toBe(SEAT_OPACITY.FULL);
        });

        // Regression guard for #557: a sitting-in player must not render at full opacity.
        it("dims a sitting-in player (regression #557)", () => {
            const result = getSeatOpacityClass({ status: PlayerStatus.SITTING_IN, hasWinner: false, isWinner: false });
            expect(result).toBe(SEAT_OPACITY.IDLE);
            expect(result).not.toBe(SEAT_OPACITY.FULL);
        });
    });
});
