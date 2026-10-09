import { cardLabel, chiSquaredBadge, distributionVerdict, formatChiSquared, isIndexerSynced, sortCardsBySuit, suitColor } from "./cardDistribution";

describe("sortCardsBySuit", () => {
    it("groups by spades, hearts, diamonds, clubs then orders ranks 2..A", () => {
        const cards = [
            { rank: "A", suit: "c" },
            { rank: "2", suit: "h" },
            { rank: "K", suit: "s" },
            { rank: "T", suit: "s" },
            { rank: "3", suit: "d" }
        ];
        expect(sortCardsBySuit(cards).map(c => `${c.rank}${c.suit}`)).toEqual(["Ts", "Ks", "2h", "3d", "Ac"]);
    });

    it("accepts upper-case suits and lower-case ranks", () => {
        expect(sortCardsBySuit([{ rank: "a", suit: "S" }, { rank: "2", suit: "S" }]).map(c => c.rank)).toEqual(["2", "a"]);
    });
});

describe("suitColor / cardLabel", () => {
    it("maps suits to their colours", () => {
        expect(suitColor("h")).toBe("#f87171");
        expect(suitColor("C")).toBe("#15803d");
    });

    it("throws on an unknown suit", () => {
        expect(() => suitColor("x")).toThrow();
    });

    it("names a card", () => {
        expect(cardLabel({ rank: "a", suit: "s" })).toBe("A of spades");
    });
});

describe("chiSquaredBadge", () => {
    it("maps every indexer result", () => {
        expect(chiSquaredBadge("PASS")).toBe("pass");
        expect(chiSquaredBadge("MARGINAL")).toBe("marginal");
        expect(chiSquaredBadge("FAIL")).toBe("fail");
        expect(chiSquaredBadge("NO_DATA")).toBe("noData");
    });

    it("throws on an unknown result", () => {
        expect(() => chiSquaredBadge("MAYBE")).toThrow();
    });
});

describe("distributionVerdict", () => {
    it("waits when there is no result or no cards", () => {
        expect(distributionVerdict(null, 100)).toBe("waiting");
        expect(distributionVerdict("PASS", 0)).toBe("waiting");
        expect(distributionVerdict("NO_DATA", 10)).toBe("waiting");
    });

    it("is fair on a pass and flags bias otherwise", () => {
        expect(distributionVerdict("PASS", 10)).toBe("fair");
        expect(distributionVerdict("MARGINAL", 10)).toBe("bias");
        expect(distributionVerdict("FAIL", 10)).toBe("bias");
    });
});

describe("isIndexerSynced", () => {
    it("compares the last indexed height with the chain head", () => {
        expect(isIndexerSynced({ total_blocks: 490456, last_block_indexed: 490451 })).toBe(true);
        expect(isIndexerSynced({ total_blocks: 490456, last_block_indexed: 1000 })).toBe(false);
    });
});

describe("formatChiSquared", () => {
    it("formats the statistic, degrees of freedom and p-value", () => {
        expect(formatChiSquared({ chi_squared: 44.123, degrees_of_freedom: 51, p_value: 0.7412 })).toBe("χ² 44.1 · df 51 · p 0.741");
    });
});
