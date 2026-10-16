import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionDTO, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { PotSizedBetButtons } from "./PotSizedBetButtons";
import type { PotSizedBetButtonsProps } from "./types";

// Cash game: amounts in dollars for min/max, micro for pot/call.
// $1/$2 blinds, SB called, BB checked: $4 pot on the flop, first to act.
const baseProps: PotSizedBetButtonsProps = {
    totalPotMicro: 4_000_000n, // $4 pot
    callAmountMicro: 0n, // first to act (opening bet)
    minAmount: 2, // legal min open = one big blind
    maxAmount: 100, // deep stack
    isTournament: false,
    currentRound: TexasHoldemRound.FLOP,
    previousActions: [],
    disabled: false,
    onAmountSelect: jest.fn(),
    onAllIn: jest.fn(),
    maxIsAllIn: true
};

const renderButtons = (overrides: Partial<PotSizedBetButtonsProps> = {}) => {
    const onAmountSelect = jest.fn();
    const onAllIn = jest.fn();
    render(<PotSizedBetButtons {...baseProps} onAmountSelect={onAmountSelect} onAllIn={onAllIn} {...overrides} />);
    return { onAmountSelect, onAllIn };
};

describe("PotSizedBetButtons — presets below the minimum bet are greyed out", () => {
    it("disables 1/4 Pot when a quarter of the pot is below the big blind ($4 pot → $1 < $2)", () => {
        const { onAmountSelect } = renderButtons();
        const quarter = screen.getByText("1/4 Pot");
        expect(quarter).toBeDisabled();
        fireEvent.click(quarter);
        expect(onAmountSelect).not.toHaveBeenCalled();
    });

    it("keeps 1/2 Pot enabled when it exactly meets the big blind ($4 pot → $2)", () => {
        const { onAmountSelect } = renderButtons();
        const half = screen.getByText("1/2 Pot");
        expect(half).not.toBeDisabled();
        fireEvent.click(half);
        expect(onAmountSelect).toHaveBeenCalledWith(2);
    });

    it("judges each preset on its own: 3/4 Pot and Pot stay enabled", () => {
        const { onAmountSelect } = renderButtons();
        fireEvent.click(screen.getByText("3/4 Pot"));
        fireEvent.click(screen.getByText("Pot"));
        expect(onAmountSelect).toHaveBeenNthCalledWith(1, 3);
        expect(onAmountSelect).toHaveBeenNthCalledWith(2, 4);
    });

    it("selects the true fraction when it is above the minimum", () => {
        const { onAmountSelect } = renderButtons({ totalPotMicro: 100_000_000n }); // $100 pot
        fireEvent.click(screen.getByText("1/4 Pot"));
        expect(onAmountSelect).toHaveBeenCalledWith(25);
    });

    it("rounds a preset to the nearest cent ($45.824 pot → 1/4 = $11.456 → $11.46)", () => {
        const { onAmountSelect } = renderButtons({ totalPotMicro: 45_824_000n });
        fireEvent.click(screen.getByText("1/4 Pot"));
        expect(onAmountSelect).toHaveBeenCalledWith(11.46);
    });

    it("disables a preset below a legal minimum raise that is higher than the big blind", () => {
        // Facing a $2 bet into a $6 pot: 1/4 = call + 1/4×(call+pot) = 2 + 2 = $4,
        // below a $10 legal minimum RAISE TO.
        renderButtons({ callAmountMicro: 2_000_000n, totalPotMicro: 6_000_000n, minAmount: 10 });
        expect(screen.getByText("1/4 Pot")).toBeDisabled();
        // Pot = 2 + 8 = $10 meets the minimum raise.
        expect(screen.getByText("Pot")).not.toBeDisabled();
    });

    it("never selects more than the stack (above the stack the preset shoves the stack)", () => {
        const { onAmountSelect } = renderButtons({ totalPotMicro: 100_000_000n, maxAmount: 15 });
        const quarter = screen.getByText("1/4 Pot");
        expect(quarter).not.toBeDisabled(); // $25 raw is above min, so the preset is live
        fireEvent.click(quarter); // $25, capped at the $15 stack
        expect(onAmountSelect).toHaveBeenCalledWith(15);
    });

    it("disables the presets when the legal minimum exceeds the stack (short stack shoves via ALL-IN)", () => {
        renderButtons({ minAmount: 10, maxAmount: 5 });
        expect(screen.getByText("1/4 Pot")).toBeDisabled();
        expect(screen.getByText("1/2 Pot")).toBeDisabled();
        expect(screen.getByText("Pot")).toBeDisabled();
        // ALL-IN stays enabled so the short stack can still act.
        expect(screen.getByText("ALL-IN")).not.toBeDisabled();
    });

    it("disables every preset button when disabled is set", () => {
        renderButtons({ disabled: true });
        expect(screen.getByText("1/2 Pot")).toBeDisabled();
        expect(screen.getByText("ALL-IN")).toBeDisabled();
    });

    it("uses whole chips in tournaments (900 chips → 1/4 = 225, min 100)", () => {
        const { onAmountSelect } = renderButtons({ isTournament: true, totalPotMicro: 900n, minAmount: 100, maxAmount: 5000 });
        fireEvent.click(screen.getByText("1/4 Pot"));
        expect(onAmountSelect).toHaveBeenCalledWith(225);
    });

    it("disables a tournament preset that comes out below the chip minimum (300 chips → 1/4 = 75 < 100)", () => {
        const { onAmountSelect } = renderButtons({ isTournament: true, totalPotMicro: 300n, minAmount: 100, maxAmount: 5000 });
        const quarter = screen.getByText("1/4 Pot");
        expect(quarter).toBeDisabled();
        fireEvent.click(quarter);
        expect(onAmountSelect).not.toHaveBeenCalled();
    });

    it("shows a tooltip explaining why a preset is greyed out", () => {
        renderButtons();
        expect(screen.getByText("1/4 Pot")).toHaveAttribute("title", "Below the minimum bet");
        expect(screen.getByText("1/2 Pot")).not.toHaveAttribute("title");
    });

    it("fires onAllIn when ALL-IN is clicked", () => {
        const { onAllIn, onAmountSelect } = renderButtons();
        fireEvent.click(screen.getByText("ALL-IN"));
        expect(onAllIn).toHaveBeenCalledTimes(1);
        expect(onAmountSelect).not.toHaveBeenCalled();
    });

    // ui#768: at pot-limit the engine caps the max at the pot, so a deep
    // stack's max is not an all-in and must not be labelled one.
    it("labels the max button MAX when the pot-limit caps it below the stack", () => {
        const { onAllIn } = renderButtons({ maxIsAllIn: false });
        expect(screen.queryByText("ALL-IN")).toBeNull();
        fireEvent.click(screen.getByText("MAX"));
        expect(onAllIn).toHaveBeenCalledTimes(1);
    });

    describe("cent rounding at the minimum boundary", () => {
        it("enables a preset whose fraction rounds UP to exactly the minimum ($7.98 pot → 1/4 = $1.995 → $2.00)", () => {
            const { onAmountSelect } = renderButtons({ totalPotMicro: 7_980_000n });
            const quarter = screen.getByText("1/4 Pot");
            expect(quarter).not.toBeDisabled();
            fireEvent.click(quarter);
            expect(onAmountSelect).toHaveBeenCalledWith(2);
        });

        it("disables a preset whose fraction rounds to just under the minimum ($7.96 pot → 1/4 = $1.99)", () => {
            renderButtons({ totalPotMicro: 7_960_000n });
            expect(screen.getByText("1/4 Pot")).toBeDisabled();
        });
    });

    it("caps an above-stack preset at the stack when facing a bet (Pot = 2 + 8 = $10 > $5 stack)", () => {
        const { onAmountSelect } = renderButtons({ callAmountMicro: 2_000_000n, totalPotMicro: 6_000_000n, minAmount: 4, maxAmount: 5 });
        const pot = screen.getByText("Pot");
        expect(pot).not.toBeDisabled();
        fireEvent.click(pot);
        expect(onAmountSelect).toHaveBeenCalledWith(5);
    });
});

// The values from the original #692 tests ($0.01/$0.02 blinds, $0.04 pot) are
// kept as their own case: previously 1/4 Pot was floored up to the $0.02 BB, now
// it is greyed out and the next preset up makes the minimum bet.
describe("PotSizedBetButtons — #692 values ($0.01/$0.02, $0.04 pot)", () => {
    const micro692 = { totalPotMicro: 40_000n, minAmount: 0.02, maxAmount: 100 };

    it("greys out 1/4 Pot ($0.01) instead of resizing it to the $0.02 big blind", () => {
        const { onAmountSelect } = renderButtons(micro692);
        const quarter = screen.getByText("1/4 Pot");
        expect(quarter).toBeDisabled();
        fireEvent.click(quarter);
        expect(onAmountSelect).not.toHaveBeenCalled();
    });

    it("1/2 Pot makes the minimum $0.02 bet", () => {
        const { onAmountSelect } = renderButtons(micro692);
        fireEvent.click(screen.getByText("1/2 Pot"));
        expect(onAmountSelect).toHaveBeenCalledWith(0.02);
    });
});

// Pre-flop presets (ui#751): multiples of the current bet instead of pot fractions.
describe("PotSizedBetButtons — pre-flop presets (0.01/0.02)", () => {
    const act = (playerId: string, action: PlayerActionType, amount: string, round: TexasHoldemRound = TexasHoldemRound.PREFLOP): ActionDTO => ({
        playerId,
        seat: 1,
        action,
        amount,
        round,
        index: 0,
        timestamp: 0
    });
    const blinds = [
        act("sb", PlayerActionType.SMALL_BLIND, "10000", TexasHoldemRound.ANTE),
        act("bb", PlayerActionType.BIG_BLIND, "20000", TexasHoldemRound.ANTE)
    ];

    // Small blind to act: $0.01 to call, $0.03 in the pot, min raise adds $0.03 (raise to $0.04).
    const sbUnopened = {
        currentRound: TexasHoldemRound.PREFLOP,
        previousActions: blinds,
        callAmountMicro: 10_000n,
        totalPotMicro: 30_000n,
        minAmount: 0.03,
        maxAmount: 2
    };

    it("shows the four opening multiples 2x / 2.5x / 3x / 5x (no Pot) in an unopened pot", () => {
        renderButtons(sbUnopened);
        for (const label of ["2x", "2.5x", "3x", "5x", "ALL-IN"]) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
        // The opening raise is four multiples + ALL-IN — no pot buttons.
        expect(screen.queryByText("Pot")).not.toBeInTheDocument();
        expect(screen.queryByText("1/4 Pot")).not.toBeInTheDocument();
    });

    it("2x / 2.5x / 3x / 5x add the chips to raise to $0.04 / $0.05 / $0.06 / $0.10 from the small blind", () => {
        const { onAmountSelect } = renderButtons(sbUnopened);
        fireEvent.click(screen.getByText("2x"));
        fireEvent.click(screen.getByText("2.5x"));
        fireEvent.click(screen.getByText("3x"));
        fireEvent.click(screen.getByText("5x"));
        // SB has $0.01 in, so added = raise-to − $0.01: 0.03 / 0.04 / 0.05 / 0.09.
        expect(onAmountSelect.mock.calls.map(c => c[0])).toEqual([0.03, 0.04, 0.05, 0.09]);
    });

    it("facing a pre-flop raise, reverts to pot fractions (no multiples)", () => {
        renderButtons({
            ...sbUnopened,
            previousActions: [...blinds, act("utg", PlayerActionType.RAISE, "60000")],
            callAmountMicro: 60_000n,
            totalPotMicro: 90_000n,
            minAmount: 0.1
        });
        for (const label of ["1/4 Pot", "1/2 Pot", "3/4 Pot", "Pot", "ALL-IN"]) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
        expect(screen.queryByText("2x")).not.toBeInTheDocument();
        expect(screen.queryByText("5x")).not.toBeInTheDocument();
    });

    it("greys out an opening multiple below the minimum raise", () => {
        // Min raise is $0.04 added: 2x (adds $0.03) is too small; 2.5x (adds $0.04) is fine.
        renderButtons({ ...sbUnopened, minAmount: 0.04 });
        expect(screen.getByText("2x")).toBeDisabled();
        expect(screen.getByText("2.5x")).not.toBeDisabled();
    });

    it("keeps pot fractions on the flop", () => {
        renderButtons({ ...sbUnopened, currentRound: TexasHoldemRound.FLOP, callAmountMicro: 0n, totalPotMicro: 40_000n, minAmount: 0.02 });
        expect(screen.getByText("1/2 Pot")).toBeInTheDocument();
        expect(screen.queryByText("2x")).not.toBeInTheDocument();
    });
});
