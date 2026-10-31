import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TableBubble, clampToViewport, BUBBLE_SIZE_PX } from "./TableBubble";

const pointer = (type: string, clientX: number, clientY: number) => {
    const ev = new MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 });
    Object.assign(ev, { pointerId: 1, pointerType: "mouse" });
    return ev;
};

describe("TableBubble (ui#887)", () => {
    const setup = (over: Partial<React.ComponentProps<typeof TableBubble>> = {}) => {
        const onSelect = jest.fn();
        const onDrop = jest.fn();
        render(
            <TableBubble id="0xT1" name="Alpha" isActive={false} x={200} y={300} onSelect={onSelect} onDrop={onDrop} {...over} />
        );
        return { onSelect, onDrop, bubble: screen.getByTestId("table-bubble-0xT1") };
    };

    it("shows only the hole cards (no name on its face) and is labelled with the table name", () => {
        const { bubble } = setup({ status: { isMyTurn: false, holeCards: ["AS", "KH"] } });
        expect(screen.getByAltText("AS")).toBeInTheDocument();
        expect(screen.getByAltText("KH")).toBeInTheDocument();
        expect(bubble).not.toHaveTextContent("Alpha");
        expect(bubble).toHaveAttribute("aria-label", "Alpha");
    });

    it("shows card backs between hands", () => {
        setup();
        expect(screen.getAllByAltText("??")).toHaveLength(2);
    });

    it("glows on your turn", () => {
        const { bubble } = setup({ status: { isMyTurn: true, holeCards: [] } });
        expect(bubble.className).toContain("b52-pill-your-turn");
        expect(bubble).toHaveAttribute("aria-label", "Alpha — your turn");
    });

    it("a click switches to its table", () => {
        const { bubble, onSelect, onDrop } = setup();
        fireEvent(bubble, pointer("pointerdown", 200, 300));
        fireEvent(window, pointer("pointerup", 201, 300));
        expect(onSelect).toHaveBeenCalledWith("0xT1");
        expect(onDrop).not.toHaveBeenCalled();
    });

    it("a drag moves it and reports the drop point instead of switching", () => {
        const { bubble, onSelect, onDrop } = setup();
        fireEvent(bubble, pointer("pointerdown", 200, 300));
        fireEvent(window, pointer("pointermove", 260, 380));
        expect(bubble.style.left).toBe("260px");
        fireEvent(window, pointer("pointerup", 400, 500));
        expect(onDrop).toHaveBeenCalledWith("0xT1", 400, 500);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("clampToViewport keeps the whole circle on screen", () => {
        const r = BUBBLE_SIZE_PX / 2 + 4;
        expect(clampToViewport(-50, 10, 800, 600)).toEqual({ x: r, y: r });
        expect(clampToViewport(900, 700, 800, 600)).toEqual({ x: 800 - r, y: 600 - r });
        expect(clampToViewport(400, 300, 800, 600)).toEqual({ x: 400, y: 300 });
    });
});
