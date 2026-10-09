import {
    SUIT_GROUPS,
    cardLabel,
    channelsToRgb,
    chiSquaredBadge,
    distributionVerdict,
    expectedLineColor,
    formatChiSquared,
    isIndexerSynced,
    readChartChrome,
    sortCardsBySuit,
    suitColor
} from "./cardDistribution";

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

    it("sorts unknown suits and ranks last without throwing", () => {
        const sorted = sortCardsBySuit([{ rank: "A", suit: "x" }, { rank: "?", suit: "s" }, { rank: "2", suit: "s" }]);
        expect(sorted.map(c => `${c.rank}${c.suit}`)).toEqual(["2s", "?s", "Ax"]);
    });
});

describe("suitColor / cardLabel", () => {
    it("maps suits to a colour per theme", () => {
        expect(suitColor("h", "dark")).toBe("#f87171");
        expect(suitColor("c", "dark")).toBe("#15803d");
        expect(suitColor("s", "dark")).toBe("#d4d4dc");
        expect(suitColor("s", "light")).not.toBe(suitColor("s", "dark"));
    });

    it("has a legend entry per suit and a line colour per theme", () => {
        expect(SUIT_GROUPS.map(g => g.key)).toEqual(["s", "h", "d", "c"]);
        expect(expectedLineColor("dark")).toBe("#eab308");
        expect(expectedLineColor("light")).not.toBe(expectedLineColor("dark"));
    });

    it("names a card", () => {
        expect(cardLabel({ rank: "a", suit: "s" })).toBe("A of spades");
        expect(cardLabel({ rank: "5", suit: "z" })).toBe("5z");
    });
});

describe("chiSquaredBadge", () => {
    it("maps every indexer result", () => {
        expect(chiSquaredBadge("PASS")).toBe("pass");
        expect(chiSquaredBadge("MARGINAL")).toBe("marginal");
        expect(chiSquaredBadge("FAIL")).toBe("fail");
        expect(chiSquaredBadge("NO_DATA")).toBe("noData");
    });
});

describe("distributionVerdict", () => {
    it("waits when there is no result or no cards", () => {
        expect(distributionVerdict(null, 100)).toBe("waiting");
        expect(distributionVerdict("PASS", 0)).toBe("waiting");
        expect(distributionVerdict("NO_DATA", 10)).toBe("waiting");
    });

    it("is fair on a pass, borderline on marginal and biased on a fail", () => {
        expect(distributionVerdict("PASS", 10)).toBe("fair");
        expect(distributionVerdict("MARGINAL", 10)).toBe("borderline");
        expect(distributionVerdict("FAIL", 10)).toBe("bias");
    });
});

describe("channelsToRgb / readChartChrome", () => {
    afterEach(() => {
        document.documentElement.style.removeProperty("--line");
        document.documentElement.style.removeProperty("--ink-muted");
    });

    it("turns token channels into a canvas colour and rejects anything else", () => {
        expect(channelsToRgb("38 41 56")).toBe("rgb(38, 41, 56)");
        expect(channelsToRgb(" 142 144 166 ")).toBe("rgb(142, 144, 166)");
        expect(channelsToRgb("")).toBeNull();
        expect(channelsToRgb("#262938")).toBeNull();
        expect(channelsToRgb("38 41")).toBeNull();
    });

    it("reads the grid and tick colours from the page tokens", () => {
        document.documentElement.style.setProperty("--line", "227 228 238");
        document.documentElement.style.setProperty("--ink-muted", "107 111 134");
        expect(readChartChrome()).toEqual({ grid: "rgb(227, 228, 238)", tick: "rgb(107, 111, 134)" });
    });

    it("is null when a token is missing", () => {
        expect(readChartChrome()).toBeNull();
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
