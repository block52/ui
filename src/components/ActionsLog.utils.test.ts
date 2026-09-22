import { ActionDTO, NonPlayerActionType, TexasHoldemRound, TexasHoldemStateDTO, PlayerActionType } from "@block52/poker-vm-sdk";
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

    // ui#660: monetary actions carry USDC micro-units even in tournaments —
    // an SNG Join's 100,000 uUSDC buy-in must read "$0.10", never
    // "100,000 chips" next to a 1,500-chip starting stack.
    it("formats an SNG join's buy-in as USDC, not tournament chips", () => {
        const line = getActionLine(
            buildAction({ action: NonPlayerActionType.JOIN, amount: "100000", round: TexasHoldemRound.ANTE }),
            true
        );
        expect(line).toBe("0x1234...5678 (Seat 3): Join $0.10 - Ante");
    });

    it("formats an SNG leave's payout as USDC, not tournament chips", () => {
        const line = getActionLine(
            buildAction({ action: NonPlayerActionType.LEAVE, amount: "200000", round: TexasHoldemRound.END }),
            true
        );
        expect(line).toBe("0x1234...5678 (Seat 3): Leave $0.20 - End");
    });

    it("keeps SNG blind posts in chips (the non-monetary path is untouched)", () => {
        const line = getActionLine(
            buildAction({ action: "post-small-blind" as PlayerActionType, amount: "100", round: TexasHoldemRound.ANTE }),
            true
        );
        expect(line).toBe("0x1234...5678 (Seat 3): Post Small Blind 100 chips - Ante");
    });

    it("leaves cash-game join formatting unchanged", () => {
        const line = getActionLine(
            buildAction({ action: NonPlayerActionType.JOIN, amount: "1000000", round: TexasHoldemRound.ANTE }),
            false
        );
        expect(line).toBe("0x1234...5678 (Seat 3): Join $1.00 - Ante");
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
