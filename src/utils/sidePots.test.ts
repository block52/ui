import { GameFormat, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { formatPotDisplay, potLabel } from "./potDisplayUtils";
import { winnerBannerText } from "./winnerBanner";

describe("side pots (ui#918)", () => {
    describe("potLabel", () => {
        it("names the main pot, a lone side pot, and numbered side pots", () => {
            expect(potLabel(0, 1)).toBe("Main Pot");
            expect(potLabel(1, 2)).toBe("Side Pot");
            expect(potLabel(1, 3)).toBe("Side Pot 1");
            expect(potLabel(2, 3)).toBe("Side Pot 2");
        });
    });

    describe("formatPotDisplay", () => {
        it("a single pot is unchanged: no side pots, Main Pot only when it differs from the total", () => {
            const result = formatPotDisplay(["1500"], "3000", GameFormat.SIT_AND_GO, TexasHoldemRound.FLOP);
            expect(result.showSidePots).toBe(false);
            expect(result.showMainPot).toBe(true);
            expect(result.pots).toEqual([{ label: "Main Pot", amount: "1,500", raw: 1500n, eligibleSeats: undefined }]);
        });

        it("lists the main pot then each side pot with eligible seats, and replaces the single Main Pot row", () => {
            const result = formatPotDisplay(["24400", "4000", "120"], "28520", GameFormat.SIT_AND_GO, TexasHoldemRound.RIVER, [
                { amount: "24400", eligibleSeats: [2, 8, 9] },
                { amount: "4000", eligibleSeats: [2, 9] },
                { amount: "120", eligibleSeats: [9] }
            ]);
            expect(result.showSidePots).toBe(true);
            expect(result.showMainPot).toBe(false);
            expect(result.pots.map(p => [p.label, p.amount, p.eligibleSeats])).toEqual([
                ["Main Pot", "24,400", [2, 8, 9]],
                ["Side Pot 1", "4,000", [2, 9]],
                ["Side Pot 2", "120", [9]]
            ]);
            expect(result.totalPot).toBe("28,520");
        });

        it("formats cash side pots as dollars", () => {
            const result = formatPotDisplay(["2000000", "500000"], "3000000", GameFormat.CASH, TexasHoldemRound.TURN);
            expect(result.pots.map(p => [p.label, p.amount])).toEqual([
                ["Main Pot", "2.00"],
                ["Side Pot", "0.50"]
            ]);
        });

        it("works without potDetails (older engine) and leaves empty pots out", () => {
            const result = formatPotDisplay(["1000", "0", "300"], "1300", GameFormat.SIT_AND_GO, TexasHoldemRound.FLOP);
            expect(result.pots.map(p => [p.label, p.eligibleSeats])).toEqual([
                ["Main Pot", undefined],
                ["Side Pot 2", undefined]
            ]);
        });

        it("shows no side pots preflop or with no pots", () => {
            expect(formatPotDisplay(["1000", "500"], "1500", GameFormat.CASH, TexasHoldemRound.PREFLOP).showSidePots).toBe(false);
            expect(formatPotDisplay([], undefined, GameFormat.CASH, TexasHoldemRound.FLOP).pots).toEqual([]);
        });
    });

    describe("winnerBannerText per pot", () => {
        it("names each pot and its winner, main pot first", () => {
            const text = winnerBannerText([
                { seat: 2, formattedAmount: "4,000 chips", winType: "showdown", pots: [{ pot: 1, formattedAmount: "4,000 chips" }] },
                { seat: 9, formattedAmount: "24,400 chips", winType: "showdown", pots: [{ pot: 0, formattedAmount: "24,400 chips" }] }
            ]);
            expect(text).toBe("Main Pot 24,400 chips to Seat 9 \u00b7 Side Pot 4,000 chips to Seat 2");
        });

        it("one player scooping every pot just wins the Total Pot, with their hand", () => {
            const text = winnerBannerText([
                {
                    seat: 8,
                    formattedAmount: "12.00",
                    winType: "showdown",
                    description: "Flush, A high",
                    pots: [
                        { pot: 0, formattedAmount: "10.00" },
                        { pot: 1, formattedAmount: "2.00" }
                    ]
                }
            ]);
            expect(text).toBe("Seat 8 wins Total Pot $12.00 with Flush, A high");
        });

        it("one player scooping every pot uncontested shows no hand", () => {
            const text = winnerBannerText([
                { seat: 1, formattedAmount: "1,800 chips", winType: "uncontested", pots: [{ pot: 0, formattedAmount: "1,200 chips" }, { pot: 1, formattedAmount: "600 chips" }] }
            ]);
            expect(text).toBe("Seat 1 wins Total Pot 1,800 chips");
        });

        it("a split side pot lists both seats", () => {
            const text = winnerBannerText([
                { seat: 1, formattedAmount: "9.00", pots: [{ pot: 0, formattedAmount: "6.00" }, { pot: 1, formattedAmount: "3.00" }] },
                { seat: 4, formattedAmount: "3.00", pots: [{ pot: 1, formattedAmount: "3.00" }] }
            ]);
            expect(text).toBe("Main Pot $6.00 to Seat 1 \u00b7 Side Pot split: Seat 1 $3.00 & Seat 4 $3.00");
        });

        it("falls back to the aggregated text without per-pot shares or with a single pot", () => {
            expect(winnerBannerText([{ seat: 3, formattedAmount: "12.50", winType: "uncontested" }])).toBe("Seat 3 wins the $12.50 pot");
            expect(winnerBannerText([{ seat: 3, formattedAmount: "12.50", winType: "uncontested", pots: [{ pot: 0, formattedAmount: "12.50" }] }])).toBe(
                "Seat 3 wins the $12.50 pot"
            );
        });
    });
});
