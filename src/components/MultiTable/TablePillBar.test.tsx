import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TablePillBar, TablePillBarProps, dropIndexFor, shiftFor, dockIndexAt, PULL_OUT_PX } from "./TablePillBar";
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
    const onReorder = jest.fn();
    const onFloat = jest.fn();
    const props: TablePillBarProps = {
        openTables: tables,
        activeId: "0xAAAA1111",
        statusById: {},
        canOpenMore: true,
        onSelect,
        onClose,
        onAddTable,
        onReorder,
        onFloat,
        ...over
    };
    const utils = render(<TablePillBar {...props} />);
    return { ...utils, onSelect, onClose, onAddTable, onReorder, onFloat };
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

    describe("drag to reorder", () => {
        // jsdom has no layout: give each pill a 100px-wide box, 8px apart.
        const layOut = () => {
            screen.getAllByRole("tab").forEach((el, i) => {
                const left = i * 108;
                el.getBoundingClientRect = () => ({ left, right: left + 100, width: 100, top: 0, bottom: 26, height: 26, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;
            });
        };
        const pointer = (type: string, clientX: number) => {
            const ev = new MouseEvent(type, { bubbles: true, clientX, button: 0 });
            Object.assign(ev, { pointerId: 1, pointerType: "mouse" });
            return ev;
        };

        it("dragging the first pill past the second swaps them, without selecting", () => {
            const { onReorder, onSelect } = renderBar();
            layOut();
            const alpha = screen.getByText("Alpha").closest('[role="tab"]') as HTMLElement;

            fireEvent(alpha, pointer("pointerdown", 50));
            fireEvent(window, pointer("pointermove", 60));
            fireEvent(window, pointer("pointermove", 170));
            fireEvent(window, pointer("pointerup", 170));
            fireEvent.click(alpha);

            expect(onReorder).toHaveBeenCalledWith("0xAAAA1111", 1);
            expect(onSelect).not.toHaveBeenCalled();
        });

        it("a press with no real movement is still a click", () => {
            const { onReorder, onSelect } = renderBar();
            layOut();
            const bravo = screen.getByText("Bravo").closest('[role="tab"]') as HTMLElement;

            fireEvent(bravo, pointer("pointerdown", 150));
            fireEvent(window, pointer("pointermove", 152));
            fireEvent(window, pointer("pointerup", 152));
            fireEvent.click(bravo);

            expect(onReorder).not.toHaveBeenCalled();
            expect(onSelect).toHaveBeenCalledWith("0xBBBB2222");
        });

        it("a drag that ends back in place does not reorder", () => {
            const { onReorder } = renderBar();
            layOut();
            const alpha = screen.getByText("Alpha").closest('[role="tab"]') as HTMLElement;

            fireEvent(alpha, pointer("pointerdown", 50));
            fireEvent(window, pointer("pointermove", 90));
            fireEvent(window, pointer("pointerup", 70));

            expect(onReorder).not.toHaveBeenCalled();
        });

        it("Alt+Arrow moves the focused pill", () => {
            const { onReorder } = renderBar();
            const bravo = screen.getByText("Bravo").closest('[role="tab"]') as HTMLElement;
            fireEvent.keyDown(bravo, { key: "ArrowLeft", altKey: true });
            expect(onReorder).toHaveBeenCalledWith("0xBBBB2222", 0);
            // Already last: moving right is a no-op.
            onReorder.mockClear();
            fireEvent.keyDown(bravo, { key: "ArrowRight", altKey: true });
            expect(onReorder).not.toHaveBeenCalled();
        });
    });

    describe("drag maths", () => {
        const centers = [50, 158, 266, 374];

        it("dropIndexFor counts the other pills left of the dragged centre", () => {
            expect(dropIndexFor(centers, 0, 0)).toBe(0);
            expect(dropIndexFor(centers, 0, 120)).toBe(1);
            expect(dropIndexFor(centers, 0, 400)).toBe(3);
            expect(dropIndexFor(centers, 3, -400)).toBe(0);
            expect(dropIndexFor(centers, 2, -20)).toBe(2);
        });

        it("shiftFor slides only the pills between from and to", () => {
            // Dragging index 0 to index 2: pills 1 and 2 slide left.
            expect([0, 1, 2, 3].map(i => shiftFor(i, 0, 2, 108))).toEqual([0, -108, -108, 0]);
            // Dragging index 3 to index 1: pills 1 and 2 slide right.
            expect([0, 1, 2, 3].map(i => shiftFor(i, 3, 1, 108))).toEqual([0, 108, 108, 0]);
        });
    });

    describe("pull out into a bubble (ui#887)", () => {
        const box = (left: number, top: number, width: number, height: number) =>
            () => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
        const layOut = () => {
            (document.querySelector(".b52-pill-bar") as HTMLElement).getBoundingClientRect = box(0, 60, 300, 32);
            screen.getAllByRole("tab").forEach((el, i) => {
                el.getBoundingClientRect = box(i * 108, 63, 100, 26);
            });
        };
        const pointer = (type: string, clientX: number, clientY: number) => {
            const ev = new MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 });
            Object.assign(ev, { pointerId: 1, pointerType: "mouse" });
            return ev;
        };

        it("dragging a pill down out of the bar floats it at the drop point", () => {
            const { onFloat, onReorder, onSelect } = renderBar();
            layOut();
            const alpha = screen.getByText("Alpha").closest('[role="tab"]') as HTMLElement;

            fireEvent(alpha, pointer("pointerdown", 50, 76));
            fireEvent(window, pointer("pointermove", 60, 120));
            fireEvent(window, pointer("pointermove", 300, 92 + PULL_OUT_PX + 200));
            // A bubble preview follows the pointer while pulling out.
            expect(screen.getByTestId("table-bubble-ghost")).toBeInTheDocument();
            fireEvent(window, pointer("pointerup", 300, 92 + PULL_OUT_PX + 200));
            fireEvent.click(alpha);

            expect(onFloat).toHaveBeenCalledWith("0xAAAA1111", 300, 92 + PULL_OUT_PX + 200);
            expect(onReorder).not.toHaveBeenCalled();
            expect(onSelect).not.toHaveBeenCalled();
            expect(screen.queryByTestId("table-bubble-ghost")).not.toBeInTheDocument();
        });

        it("a drag that stays near the bar still reorders instead of floating", () => {
            const { onFloat, onReorder } = renderBar();
            layOut();
            const alpha = screen.getByText("Alpha").closest('[role="tab"]') as HTMLElement;

            fireEvent(alpha, pointer("pointerdown", 50, 76));
            fireEvent(window, pointer("pointermove", 170, 92 + PULL_OUT_PX - 5));
            fireEvent(window, pointer("pointerup", 170, 92 + PULL_OUT_PX - 5));

            expect(onFloat).not.toHaveBeenCalled();
            expect(onReorder).toHaveBeenCalledWith("0xAAAA1111", 1);
        });

        it("dockIndexAt finds the drop slot over the bar, and null elsewhere", () => {
            renderBar();
            layOut();
            expect(dockIndexAt(10, 76)).toBe(0);
            // Pill centres are at 50 and 158.
            expect(dockIndexAt(120, 76)).toBe(1);
            expect(dockIndexAt(290, 76)).toBe(2);
            expect(dockIndexAt(160, 400)).toBeNull();
        });

        it("can stay on screen with no pills, so a bubble can dock back", () => {
            renderBar({ openTables: [], showWhenEmpty: true });
            expect(screen.getByRole("tablist")).toBeInTheDocument();
            expect(screen.getByLabelText("Open another table")).toBeInTheDocument();
        });
    });
});
