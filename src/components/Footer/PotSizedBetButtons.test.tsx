import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TexasHoldemRound } from "@block52/poker-vm-sdk";
import { PotSizedBetButtons } from "./PotSizedBetButtons";
import type { PotSizedBetButtonsProps } from "./types";

// Cash game: amounts in dollars for min/max, micro for pot/call/BB.
const baseProps: PotSizedBetButtonsProps = {
    totalPotMicro: 40_000n, // $0.04 pot
    callAmountMicro: 0n, // first to act (opening bet)
    bigBlindMicro: 20_000n, // $0.02 BB
    minAmount: 0.02, // legal min open = BB
    maxAmount: 100, // deep stack
    isTournament: false,
    currentRound: TexasHoldemRound.FLOP,
    previousActions: [],
    disabled: false,
    onAmountSelect: jest.fn(),
    onAllIn: jest.fn()
};

const renderButtons = (overrides: Partial<PotSizedBetButtonsProps> = {}) => {
    const onAmountSelect = jest.fn();
    render(<PotSizedBetButtons {...baseProps} onAmountSelect={onAmountSelect} {...overrides} />);
    return { onAmountSelect };
};

describe("PotSizedBetButtons (#692)", () => {
    it("selects the big blind for 1/4 Pot when a quarter of the pot is below it", () => {
        // pot $0.04 → 1/4 = $0.01, floored up to the $0.02 BB.
        const { onAmountSelect } = renderButtons();
        fireEvent.click(screen.getByText("1/4 Pot"));
        expect(onAmountSelect).toHaveBeenCalledWith(0.02);
    });

    it("selects the true fraction when it is above the big blind", () => {
        // pot $1.00 → 1/4 = $0.25.
        const { onAmountSelect } = renderButtons({ totalPotMicro: 1_000_000n });
        fireEvent.click(screen.getByText("1/4 Pot"));
        expect(onAmountSelect).toHaveBeenCalledWith(0.25);
    });

    it("respects a legal minimum higher than the big blind when facing a bet", () => {
        // Facing a bet: min raise ($0.10) exceeds BB; the clamp lifts a small
        // fraction up to the legal min.
        const { onAmountSelect } = renderButtons({
            callAmountMicro: 20_000n,
            totalPotMicro: 60_000n,
            minAmount: 0.1
        });
        fireEvent.click(screen.getByText("1/4 Pot"));
        // raw = call + 1/4×(call+pot) = 0.02 + 0.02 = $0.04, clamped up to $0.10.
        expect(onAmountSelect).toHaveBeenCalledWith(0.1);
    });

    it("never selects more than the stack (max clamp)", () => {
        const { onAmountSelect } = renderButtons({ totalPotMicro: 1_000_000n, maxAmount: 0.15 });
        fireEvent.click(screen.getByText("1/4 Pot")); // raw $0.25, capped at $0.15
        expect(onAmountSelect).toHaveBeenCalledWith(0.15);
    });

    it("disables the presets when the legal minimum exceeds the stack (short stack shoves via ALL-IN)", () => {
        renderButtons({ minAmount: 0.1, maxAmount: 0.05 });
        expect(screen.getByText("1/4 Pot")).toBeDisabled();
        expect(screen.getByText("Pot")).toBeDisabled();
        // ALL-IN stays enabled so the short stack can still act.
        expect(screen.getByText("ALL-IN")).not.toBeDisabled();
    });

    it("disables every preset button when disabled is set", () => {
        renderButtons({ disabled: true });
        expect(screen.getByText("1/4 Pot")).toBeDisabled();
        expect(screen.getByText("ALL-IN")).toBeDisabled();
    });
});
