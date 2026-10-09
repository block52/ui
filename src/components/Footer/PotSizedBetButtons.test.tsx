import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TexasHoldemRound } from "@block52/poker-vm-sdk";
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
    onAllIn: jest.fn()
};

const renderButtons = (overrides: Partial<PotSizedBetButtonsProps> = {}) => {
    const onAmountSelect = jest.fn();
    render(<PotSizedBetButtons {...baseProps} onAmountSelect={onAmountSelect} {...overrides} />);
    return { onAmountSelect };
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
        fireEvent.click(screen.getByText("1/4 Pot")); // $25, capped at the $15 stack
        expect(onAmountSelect).toHaveBeenCalledWith(15);
    });

    it("disables the presets when the legal minimum exceeds the stack (short stack shoves via ALL-IN)", () => {
        renderButtons({ minAmount: 10, maxAmount: 5 });
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
});
