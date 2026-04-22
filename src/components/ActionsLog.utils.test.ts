import { ActionDTO, TexasHoldemRound, TexasHoldemStateDTO, PlayerActionType } from "@block52/poker-vm-sdk";
import { getActionLine, getWinnerLine, shouldShowWinnerSummary } from "./ActionsLog.utils";
import { WinnerInfo } from "../types/index";

const buildAction = (overrides: Partial<ActionDTO> = {}): ActionDTO => ({
    playerId: "0x1234567890abcdef1234567890abcdef12345678",
    seat: 3,
    action: "call" as PlayerActionType,
    amount: "1000000",
    round: TexasHoldemRound.FLOP,
    index: 0,
    timestamp: 0,
    ...overrides
});

describe("getActionLine", () => {
    it("formats a cash-game action with player, seat, action name, amount, and round", () => {
        const line = getActionLine(buildAction(), false);
        expect(line).toBe("0x1234...5678 (Seat 3): Call $1.00 - Flop");
    });

    it("omits the amount segment when action.amount is empty", () => {
        const line = getActionLine(
            buildAction({ amount: "", action: "check" as PlayerActionType, round: TexasHoldemRound.TURN }),
            false
        );
        expect(line).toBe("0x1234...5678 (Seat 3): Check - Turn");
    });

    it("formats hyphenated action names to title case with spaces", () => {
        const line = getActionLine(
            buildAction({ action: "post-big-blind" as PlayerActionType, amount: "2000000", round: TexasHoldemRound.PREFLOP }),
            false
        );
        expect(line).toBe("0x1234...5678 (Seat 3): Post Big Blind $2.00 - Pre-flop");
    });

    it("uses chip formatting for tournament games", () => {
        const line = getActionLine(
            buildAction({ action: "raise" as PlayerActionType, amount: "1500", round: TexasHoldemRound.RIVER }),
            true
        );
        expect(line).toBe("0x1234...5678 (Seat 3): Raise 1,500 chips - River");
    });
});

describe("getWinnerLine", () => {
    it("includes the hand description when present", () => {
        const line = getWinnerLine({
            seat: 2,
            address: "0x1234567890abcdef1234567890abcdef12345678",
            amount: "5000000",
            formattedAmount: "$5.00",
            description: "Full House"
        });
        expect(line).toBe("0x1234...5678 (Seat 2): WINS Full House — $5.00");
    });

    it("omits the hand description when absent (uncontested win)", () => {
        const line = getWinnerLine({
            seat: 2,
            address: "0x1234567890abcdef1234567890abcdef12345678",
            amount: "5000000",
            formattedAmount: "$5.00"
        });
        expect(line).toBe("0x1234...5678 (Seat 2): WINS $5.00");
    });
});

describe("shouldShowWinnerSummary", () => {
    const winner: WinnerInfo = {
        seat: 1,
        address: "0xabc",
        amount: "1000000",
        formattedAmount: "$1.00"
    };

    const stateAtRound = (round: TexasHoldemRound): TexasHoldemStateDTO =>
        ({ round } as TexasHoldemStateDTO);

    it("returns true when round is END and there is at least one winner", () => {
        expect(shouldShowWinnerSummary(stateAtRound(TexasHoldemRound.END), [winner])).toBe(true);
    });

    it("returns false before the hand has ended", () => {
        expect(shouldShowWinnerSummary(stateAtRound(TexasHoldemRound.RIVER), [winner])).toBe(false);
        expect(shouldShowWinnerSummary(stateAtRound(TexasHoldemRound.SHOWDOWN), [winner])).toBe(false);
    });

    it("returns false when winnerInfo is empty or null", () => {
        expect(shouldShowWinnerSummary(stateAtRound(TexasHoldemRound.END), [])).toBe(false);
        expect(shouldShowWinnerSummary(stateAtRound(TexasHoldemRound.END), null)).toBe(false);
        expect(shouldShowWinnerSummary(stateAtRound(TexasHoldemRound.END), undefined)).toBe(false);
    });

    it("returns false when gameState is missing", () => {
        expect(shouldShowWinnerSummary(null, [winner])).toBe(false);
        expect(shouldShowWinnerSummary(undefined, [winner])).toBe(false);
    });
});
