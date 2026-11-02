import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { MultiTableRoute } from "./MultiTableWorkspace";

// The live table subtree is heavy and irrelevant to the workspace's own
// behaviour (seeding, visibility, pill bar vs single-table, the picker), so we
// stub it. Each stub is renderless or a marker so we can assert what mounted.
// The stub renders the header slot the way the real TableHeader does, so the
// pill bar / "+ Table" the workspace hands to the active table shows up.
jest.mock("../playPage/Table", () => {
    const { useTableHeaderSlot } = jest.requireActual("../../context/TableHeaderSlotContext");
    const TableStub = ({ tableId }: { tableId?: string }) => <div data-testid={`table-${tableId}`}>{useTableHeaderSlot()}</div>;
    return { __esModule: true, default: TableStub };
});
jest.mock("../../context/GameStateContext", () => ({
    GameStateProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
jest.mock("../../context/ActionSubmitContext", () => ({
    ActionSubmitProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
jest.mock("./TableStatusReporter", () => ({ TableStatusReporter: () => null }));
jest.mock("./MultiTablePicker", () => ({
    MultiTablePicker: ({ onPick }: { onPick: (id: string, name?: string) => void }) => (
        <button data-testid="picker-pick" onClick={() => onPick("table-two", "Two")}>
            pick table two
        </button>
    )
}));

const LocationProbe: React.FC = () => <div data-testid="location">{useLocation().pathname}</div>;

const renderAt = (id: string) =>
    render(
        <MemoryRouter initialEntries={[`/table/${id}`]}>
            <Routes>
                <Route path="/table/:id" element={<MultiTableRoute />} />
            </Routes>
            <LocationProbe />
        </MemoryRouter>
    );

describe("MultiTableWorkspace", () => {
    beforeEach(() => {
        try {
            localStorage.clear();
        } catch {
            /* ignore */
        }
    });

    it("seeds the route id and renders a single table like today (no pill bar)", () => {
        renderAt("table-one");

        expect(screen.getByTestId("table-table-one")).toBeInTheDocument();
        // Single-table: only the compact add button, no multi-table pill bar.
        expect(screen.getByRole("button", { name: "Open another table" })).toBeInTheDocument();
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });

    it("opens the picker and adds a second live table, showing the pill bar", () => {
        renderAt("table-one");

        fireEvent.click(screen.getByRole("button", { name: "Open another table" }));
        fireEvent.click(screen.getByTestId("picker-pick"));

        // Both tables are now mounted (the inactive one stays in the DOM, hidden).
        expect(screen.getByTestId("table-table-one")).toBeInTheDocument();
        expect(screen.getByTestId("table-table-two")).toBeInTheDocument();
        // With >1 table the pill bar (role=tablist) appears.
        expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    it("keeps only the active table's slot visible", () => {
        renderAt("table-one");
        fireEvent.click(screen.getByRole("button", { name: "Open another table" }));
        fireEvent.click(screen.getByTestId("picker-pick"));

        // Opening table-two makes it active; table-one's slot is hidden.
        const activeSlot = screen.getByTestId("multitable-slot-table-two");
        const hiddenSlot = screen.getByTestId("multitable-slot-table-one");
        expect(activeSlot).toHaveAttribute("data-active", "true");
        expect(hiddenSlot).toHaveAttribute("data-active", "false");
        expect(hiddenSlot).toHaveStyle({ display: "none" });
    });

    it("a deep link opens the linked table, not the persisted active one", () => {
        // A previous visit left table-old open and active.
        localStorage.setItem("b52.multitable.v1", JSON.stringify({ openTables: [{ id: "table-old" }], activeId: "table-old" }));

        renderAt("table-new");

        expect(screen.getByTestId("location")).toHaveTextContent("/table/table-new");
        expect(screen.getByTestId("multitable-slot-table-new")).toHaveAttribute("data-active", "true");
        expect(screen.getByTestId("multitable-slot-table-old")).toHaveAttribute("data-active", "false");
        // The linked table is now the persisted active one.
        expect(JSON.parse(localStorage.getItem("b52.multitable.v1") ?? "{}").activeId).toBe("table-new");
    });

    it("switching pills updates the URL to the selected table", () => {
        renderAt("table-one");
        fireEvent.click(screen.getByRole("button", { name: "Open another table" }));
        fireEvent.click(screen.getByTestId("picker-pick"));
        expect(screen.getByTestId("location")).toHaveTextContent("/table/table-two");
    });

    it("puts the header controls only in the active table's header", () => {
        renderAt("table-one");
        fireEvent.click(screen.getByRole("button", { name: "Open another table" }));
        fireEvent.click(screen.getByTestId("picker-pick"));

        // One pill bar, inside the active (table-two) slot; none in the hidden one.
        expect(screen.getAllByRole("tablist")).toHaveLength(1);
        expect(screen.getByTestId("table-table-two")).toContainElement(screen.getByRole("tablist"));
        expect(screen.getByTestId("table-table-one")).toBeEmptyDOMElement();
    });
});
