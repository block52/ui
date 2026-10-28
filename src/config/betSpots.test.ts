import { betBoardFor, betSideFor, dealerSideFor, placeBetSpots, seatEnvelope, getAllPositions, getStageDims, getViewportMode, withBetSpots, type TableSize, type ViewportMode } from "./stageGeometry";

const W = 1000;
const H = 500;
const env = seatEnvelope(false);
const box = (spot: { left: string; top?: string; side?: string }) => {
    const x = parseFloat(spot.left);
    const y = parseFloat(spot.top ?? "0");
    const halfH = Math.max(env.groupHalfH, env.buttonW / 2);
    if (spot.side === "left") return { l: x - env.groupW / 2, r: x + env.groupW / 2 + env.buttonW, t: y - halfH, b: y + halfH };
    return { l: x - env.groupW / 2 - env.buttonW, r: x + env.groupW / 2, t: y - halfH, b: y + halfH };
};
const overlap = (p: ReturnType<typeof box>, q: ReturnType<typeof box>) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b;

describe("bet spots beside the seat", () => {
    it("classifies seats by felt edge", () => {
        expect(betSideFor(500, -40, W, H)).toBe("top");
        expect(betSideFor(275, 540, W, H)).toBe("bottom");
        expect(betSideFor(20, 250, W, H)).toBe("left");
        expect(betSideFor(980, 100, W, H)).toBe("right");
    });

    it("puts the button left of the chips except on the left arc", () => {
        expect(dealerSideFor("top")).toBe("left");
        expect(dealerSideFor("bottom")).toBe("left");
        expect(dealerSideFor("right")).toBe("left");
        expect(dealerSideFor("left")).toBe("right");
    });

    it("centres top bets on the seat's x, below the seat and its banner", () => {
        const [spot] = placeBetSpots([{ left: "500px", top: "-47px" }], env, W, H);
        expect(spot.side).toBe("top");
        expect(parseFloat(spot.left)).toBe(500);
        expect(parseFloat(spot.top ?? "NaN")).toBe(-47 + env.below + env.gap + env.groupHalfH);
    });

    it("centres bottom bets on the seat's x, above the hole cards", () => {
        const [spot] = placeBetSpots([{ left: "500px", top: "547px" }], env, W, H);
        expect(spot.side).toBe("bottom");
        expect(parseFloat(spot.left)).toBe(500);
        expect(parseFloat(spot.top ?? "NaN")).toBe(547 - env.above - env.gap - env.groupHalfH);
    });

    it("puts an upper-half side seat's bet under its pill, centred on its x", () => {
        // 9-max seat 4 (upper-left corner).
        const [spot] = placeBetSpots([{ left: "84.1px", top: "22.5px" }], env, W, H);
        expect(spot.side).toBe("left");
        expect(parseFloat(spot.left)).toBeCloseTo(84.1, 1);
        expect(parseFloat(spot.top ?? "NaN")).toBeCloseTo(22.5 + env.below + env.gap + env.groupHalfH, 1);
    });

    it("puts a lower-half side seat's bet above its hole cards, centred on its x", () => {
        // 9-max seat 8 (right end, below the felt's middle). The button is on the left.
        const [spot] = placeBetSpots([{ left: "1004.1px", top: "351.6px" }], env, W, H);
        expect(spot.side).toBe("right");
        expect(parseFloat(spot.left)).toBeCloseTo(1004.1, 1);
        expect(parseFloat(spot.top ?? "NaN")).toBeCloseTo(351.6 - env.above - env.gap - env.groupHalfH, 1);
    });

    it("never moves a rail-end bet off the seat's x, so the group stays centred on the pill", () => {
        const [left, right] = placeBetSpots([{ left: "-55px", top: "351px" }, { left: "1055px", top: "351px" }], env, W, H);
        expect(parseFloat(left.left)).toBe(-55);
        expect(parseFloat(right.left)).toBe(1055);
    });

    it("uses the seat's other side when the preferred spot is on the board and the other side is clear", () => {
        const board = [{ x: 500, y: 250, hw: 100, hy: 60 }];
        const [spot] = placeBetSpots([{ left: "500px", top: "120px" }], env, W, H, board);
        expect(parseFloat(spot.top ?? "NaN")).toBeCloseTo(120 - env.above - env.gap - env.groupHalfH, 1);
    });

    it("keeps the preferred side when flipping would land on another seat's bet", () => {
        const board = [{ x: 500, y: 250, hw: 100, hy: 60 }];
        const seats = [{ left: "500px", top: "120px" }, { left: "520px", top: "-95px" }];
        const [spot] = placeBetSpots(seats, env, W, H, board);
        expect(parseFloat(spot.top ?? "NaN")).toBeCloseTo(120 + env.below + env.gap + env.groupHalfH, 1);
    });

    it("never flips bets on mobile portrait 6-max", () => {
        expect(betBoardFor(6, true, 500, 1000)).toEqual([]);
        expect(betBoardFor(9, true, 500, 1000)).toHaveLength(1);
        expect(betBoardFor(6, false, 1000, 500)).toHaveLength(1);
    });
});

const setViewport = (width: number, height: number, coarse: boolean) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
    window.matchMedia = ((query: string) => ({
        matches: coarse && query.includes("coarse"),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
    })) as unknown as typeof window.matchMedia;
};

const VIEWPORTS: Array<[string, number, number, boolean, ViewportMode]> = [
    ["desktop", 1440, 900, false, "desktop"],
    ["mobile portrait", 390, 844, true, "mobile-portrait"],
    ["mobile landscape", 844, 390, true, "mobile-landscape"]
];

describe.each(VIEWPORTS)("bet spots and dealer button on %s", (_name, width, height, coarse, mode) => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    const originalMatchMedia = window.matchMedia;
    beforeAll(() => setViewport(width, height, coarse));
    afterAll(() => {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
        Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight });
        window.matchMedia = originalMatchMedia;
    });

    it("is in the expected viewport mode", () => {
        expect(getViewportMode()).toBe(mode);
    });

    it.each([6, 9] as TableSize[])("%i-max: every bet (and button) sits on its own seat's x, on the felt side, and no two overlap", size => {
        const positions = withBetSpots(getAllPositions(size), size, mode);
        const { tableHeight } = getStageDims();
        expect(positions.chips).toHaveLength(size);
        positions.chips.forEach((spot, i) => {
            const seat = positions.players[i];
            // AC-1: the button rides with the bet, directly in front of its own seat, from every seat.
            expect(parseFloat(spot.left)).toBeCloseTo(parseFloat(seat.left), 1);
            expect(spot.side).toBeDefined();
            const seatY = parseFloat(seat.top);
            const betY = parseFloat(spot.top ?? "NaN");
            expect(Math.abs(betY - seatY)).toBeLessThan(env.below + env.gap + 2 * env.groupHalfH + 1);
            expect(parseFloat(spot.bottom)).toBeCloseTo(tableHeight - betY, 1);
        });
        for (let i = 0; i < positions.chips.length; i++) {
            for (let j = i + 1; j < positions.chips.length; j++) {
                expect(overlap(box(positions.chips[i]), box(positions.chips[j]))).toBe(false);
            }
        }
    });
});
