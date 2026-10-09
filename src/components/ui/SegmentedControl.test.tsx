import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
    { value: "all", label: "All", count: 5 },
    { value: "cash", label: "Cash" },
    { value: "sng", label: "Sit & Go" }
] as const;

const Harness = ({ initial = "all" }: { initial?: "all" | "cash" | "sng" }) => {
    const [value, setValue] = React.useState<"all" | "cash" | "sng">(initial);
    return <SegmentedControl options={OPTIONS} value={value} onChange={setValue} ariaLabel="Game format" />;
};

describe("SegmentedControl", () => {
    it("is a radio group with one checked radio", () => {
        render(<Harness initial="cash" />);
        expect(screen.getByRole("radiogroup", { name: "Game format" })).toBeInTheDocument();
        expect(screen.queryByRole("tab")).not.toBeInTheDocument();
        expect(screen.getByRole("radio", { name: "Cash" })).toBeChecked();
        expect(screen.getByRole("radio", { name: /^All/ })).not.toBeChecked();
    });

    it("keeps only the checked radio in the tab order", () => {
        render(<Harness initial="cash" />);
        expect(screen.getByRole("radio", { name: "Cash" })).toHaveAttribute("tabindex", "0");
        expect(screen.getByRole("radio", { name: "Sit & Go" })).toHaveAttribute("tabindex", "-1");
    });

    it("selects on click", () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole("radio", { name: "Sit & Go" }));
        expect(screen.getByRole("radio", { name: "Sit & Go" })).toBeChecked();
    });

    it("moves selection and focus with arrow keys, wrapping at the ends", () => {
        render(<Harness />);
        const all = screen.getByRole("radio", { name: /^All/ });
        all.focus();
        fireEvent.keyDown(all, { key: "ArrowRight" });
        expect(screen.getByRole("radio", { name: "Cash" })).toBeChecked();
        expect(screen.getByRole("radio", { name: "Cash" })).toHaveFocus();
        fireEvent.keyDown(screen.getByRole("radio", { name: "Cash" }), { key: "ArrowLeft" });
        fireEvent.keyDown(screen.getByRole("radio", { name: /^All/ }), { key: "ArrowLeft" });
        expect(screen.getByRole("radio", { name: "Sit & Go" })).toBeChecked();
        fireEvent.keyDown(screen.getByRole("radio", { name: "Sit & Go" }), { key: "Home" });
        expect(screen.getByRole("radio", { name: /^All/ })).toBeChecked();
        fireEvent.keyDown(screen.getByRole("radio", { name: /^All/ }), { key: "End" });
        expect(screen.getByRole("radio", { name: "Sit & Go" })).toHaveFocus();
    });
});
