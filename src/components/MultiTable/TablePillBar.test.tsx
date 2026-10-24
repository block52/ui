import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TablePillBar, TablePillBarProps } from "./TablePillBar";
import { OpenTable, TableStatus } from "../../context/tableSessions/sessionsModel";

// jsdom has no real image loading; getCardImageUrl just returns a string src, fine here.

const tables: OpenTable[] = [
    { id: "0xAAAA1111", name: "Alpha" },
    { id: "0xBBBB2222", name: "Bravo" }
];

const renderBar = (over: Partial<TablePillBarProps> = {}) => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const onAddTable = jest.fn();
    const props: TablePillBarProps = {
        openTables: tables,
        activeId: "0xAAAA1111",
        statusById: {},
        canOpenMore: true,
        onSelect,
        onClose,
        onAddTable,
        ...over
    };
    const utils = render(<TablePillBar {...props} />);
    return { ...utils, onSelect, onClose, onAddTable };
};

describe("TablePillBar", () => {
    it("renders a pill per open table", () => {
        renderBar();
        expect(screen.getByText("Alpha")).toBeInTheDocument();
        expect(screen.getByText("Bravo")).toBeInTheDocument();
    });

    it("renders nothing when no tables are open", () => {
        const { container } = renderBar({ openTables: [] });
        expect(container).toBeEmptyDOMElement();
    });

    it("clicking a pill selects that table", () => {
        const { onSelect } = renderBar();
        fireEvent.click(screen.getByText("Bravo"));
        expect(onSelect).toHaveBeenCalledWith("0xBBBB2222");
    });

    it("marks the active pill as selected", () => {
        renderBar({ activeId: "0xBBBB2222" });
        const bravo = screen.getByText("Bravo").closest('[role="tab"]');
        expect(bravo).toHaveAttribute("aria-selected", "true");
    });

    it("close button closes its table without selecting", () => {
        const { onClose, onSelect } = renderBar();
        fireEvent.click(screen.getByLabelText("Close Alpha"));
        expect(onClose).toHaveBeenCalledWith("0xAAAA1111");
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("the + button opens another table when allowed", () => {
        const { onAddTable } = renderBar();
        fireEvent.click(screen.getByLabelText("Open another table"));
        expect(onAddTable).toHaveBeenCalled();
    });

    it("the + button is disabled at the table cap", () => {
        const { onAddTable } = renderBar({ canOpenMore: false });
        const add = screen.getByLabelText("Open another table");
        expect(add).toBeDisabled();
        fireEvent.click(add);
        expect(onAddTable).not.toHaveBeenCalled();
    });

    it("glows the pill whose turn it is", () => {
        const status: Record<string, TableStatus> = {
            "0xBBBB2222": { isMyTurn: true, holeCards: ["AS", "KH"] }
        };
        renderBar({ statusById: status });
        const bravo = screen.getByText("Bravo").closest('[role="tab"]');
        expect(bravo?.className).toContain("b52-pill-your-turn");
        // Alpha (not its turn) does not glow.
        const alpha = screen.getByText("Alpha").closest('[role="tab"]');
        expect(alpha?.className).not.toContain("b52-pill-your-turn");
    });

    it("shows the hole cards reported for a table", () => {
        const status: Record<string, TableStatus> = {
            "0xAAAA1111": { isMyTurn: false, holeCards: ["AS", "KH"] }
        };
        renderBar({ statusById: status });
        expect(screen.getByAltText("AS")).toBeInTheDocument();
        expect(screen.getByAltText("KH")).toBeInTheDocument();
    });
});
