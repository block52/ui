import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RaiseSlider } from "./RaiseSlider";
import type { RaiseSliderProps } from "./types";

const renderSlider = (over: Partial<RaiseSliderProps> = {}) => {
    const onChange = jest.fn();
    const props: RaiseSliderProps = {
        value: 0.1,
        min: 0.1,
        max: 1.99,
        formattedMax: "$1.99",
        displayOffset: 0,
        isInvalid: false,
        disabled: false,
        isMobileLandscape: false,
        isTournament: false,
        isAllIn: false,
        onChange,
        onIncrement: jest.fn(),
        onDecrement: jest.fn(),
        ...over
    };
    render(<RaiseSlider {...props} />);
    return { onChange, slider: screen.getByRole("slider", { name: "Bet amount" }) as HTMLInputElement };
};

describe("RaiseSlider (ui#890)", () => {
    it("sits on the legal minimum and spans it to the max in 1¢ steps", () => {
        const { slider } = renderSlider();
        expect(slider.value).toBe("0");
        expect(slider.min).toBe("0");
        expect(slider.step).toBe("1");
        // 10¢ → $1.99 is 189 one-cent steps.
        expect(slider.max).toBe("189");
    });

    it("dragging one step moves the bet by exactly 1¢", () => {
        const { slider, onChange } = renderSlider();
        fireEvent.change(slider, { target: { value: "1" } });
        expect(onChange).toHaveBeenLastCalledWith(0.11);
        fireEvent.change(slider, { target: { value: "3" } });
        expect(onChange).toHaveBeenLastCalledWith(0.13);
    });

    it("the far right is exactly the max, even for an uneven stack", () => {
        const { slider, onChange } = renderSlider({ min: 0.04, max: 1.234567 });
        fireEvent.change(slider, { target: { value: slider.max } });
        expect(onChange).toHaveBeenLastCalledWith(1.234567);
    });

    it("tournaments step whole chips", () => {
        const { slider, onChange } = renderSlider({ value: 100, min: 100, max: 1500, isTournament: true, formattedMax: "1,500" });
        expect(slider.max).toBe("1400");
        fireEvent.change(slider, { target: { value: "1" } });
        expect(onChange).toHaveBeenLastCalledWith(101);
    });

    it("shows the ALL-IN tag only when the amount is the whole stack", () => {
        renderSlider();
        expect(screen.queryByText("ALL-IN")).not.toBeInTheDocument();
    });

    it("shows the ALL-IN tag at an all-in max", () => {
        renderSlider({ value: 1.99, isAllIn: true });
        expect(screen.getByText("ALL-IN")).toBeInTheDocument();
    });
});
