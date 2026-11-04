import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TablePill, TablePillProps } from "./TablePill";

const ID = "0x695832cb2d56a0b88f8ed5c9d6580b53003f01c7faabc29fec9d65049ee5c545";

const renderPill = (over: Partial<TablePillProps> = {}) => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    render(<TablePill id={ID} isActive={false} onSelect={onSelect} onClose={onClose} {...over} />);
    return { onSelect, onClose };
};

describe("TablePill (ui#55)", () => {
    it("shows the table's name", () => {
        renderPill({ name: "Friday degens" });
        expect(screen.getByText("Friday degens")).toBeInTheDocument();
    });

    it("falls back to a shortened table id when there's no name yet", () => {
        renderPill();
        expect(screen.getByText("0x6958…c545")).toBeInTheDocument();
    });

    it("shows the player's two hole cards, or two card backs before the deal", () => {
        const { unmount } = render(<TablePill id={ID} isActive={false} onSelect={jest.fn()} onClose={jest.fn()} status={{ holeCards: ["AS", "KH"], isMyTurn: false }} />);
        expect(screen.getByAltText("AS")).toBeInTheDocument();
        expect(screen.getByAltText("KH")).toBeInTheDocument();
        unmount();
        renderPill();
        expect(screen.getAllByAltText("??")).toHaveLength(2);
    });

    it("flags your turn", () => {
        renderPill({ name: "Alpha", status: { holeCards: [], isMyTurn: true } });
        expect(screen.getByText("Your turn")).toBeInTheDocument();
        expect(screen.getByRole("tab")).toHaveClass("b52-pill-your-turn");
        expect(screen.getByRole("tab")).toHaveAttribute("title", "Alpha — your turn");
    });

    it("marks the active table", () => {
        renderPill({ isActive: true });
        expect(screen.getByRole("tab")).toHaveAttribute("aria-selected", "true");
    });

    it("selects the table on click", () => {
        const { onSelect, onClose } = renderPill({ name: "Alpha" });
        fireEvent.click(screen.getByRole("tab"));
        expect(onSelect).toHaveBeenCalledWith(ID);
        expect(onClose).not.toHaveBeenCalled();
    });

    it("closes the table from the ✕ without also selecting it", () => {
        const { onSelect, onClose } = renderPill({ name: "Alpha" });
        fireEvent.click(screen.getByRole("button", { name: "Close Alpha" }));
        expect(onClose).toHaveBeenCalledWith(ID);
        expect(onSelect).not.toHaveBeenCalled();
    });
});
