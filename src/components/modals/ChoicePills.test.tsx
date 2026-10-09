import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChoicePill } from "../ui";
import { AmountPresets } from "./AmountPresets";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ChoicePill", () => {
    it("reflects selection through aria-pressed and defaults to type=button", () => {
        render(
            <>
                <ChoicePill selected>On</ChoicePill>
                <ChoicePill selected={false}>Off</ChoicePill>
            </>
        );
        expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByRole("button", { name: "On" })).toHaveAttribute("type", "button");
    });
});

describe("AmountPresets", () => {
    const presets = [
        { label: "$5", value: "5" },
        { label: "Max", value: "12.34" }
    ];

    it("marks the preset matching the current text and reports picks", () => {
        const onPick = jest.fn();
        render(<AmountPresets presets={presets} current="12.34" onPick={onPick} />);
        expect(screen.getByRole("button", { name: "Max" })).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(screen.getByRole("button", { name: "$5" }));
        expect(onPick).toHaveBeenCalledWith("5");
    });

    it("disables every pill when disabled", () => {
        render(<AmountPresets presets={presets} current="" onPick={jest.fn()} disabled />);
        screen.getAllByRole("button").forEach(button => expect(button).toBeDisabled());
    });
});

describe("ConfirmDialog", () => {
    it("focuses Cancel first, and Escape cancels without confirming", () => {
        const onConfirm = jest.fn();
        const onCancel = jest.fn();
        render(<ConfirmDialog isOpen title="Delete table" message="Sure?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />);
        expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
