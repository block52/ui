import { buildBuyInPresets } from "./buyInPresets";

const usd = (dollars: number): bigint => BigInt(Math.round(dollars * 1_000_000));

describe("buildBuyInPresets", () => {
    const table = { minMicro: usd(2), maxMicro: usd(10), bigBlindMicro: usd(0.02) };

    it("floors the balance to cents without float error (4.35 stays 4.35)", () => {
        const presets = buildBuyInPresets({ ...table, maxMicro: usd(100), balanceMicro: 4_350_000n });
        expect(presets[presets.length - 1]).toEqual({ label: "Max", micro: 4_350_000n });
    });

    it("keeps 1.15 as 1.15", () => {
        const presets = buildBuyInPresets({ minMicro: usd(0.5), maxMicro: usd(100), bigBlindMicro: usd(0.02), balanceMicro: 1_150_000n });
        expect(presets[presets.length - 1]).toEqual({ label: "Max", micro: 1_150_000n });
    });

    it("floors sub-cent balance remainders", () => {
        const presets = buildBuyInPresets({ ...table, balanceMicro: 5_019_999n });
        expect(presets[presets.length - 1]).toEqual({ label: "Max", micro: 5_010_000n });
    });

    it("never exceeds the table max or the balance", () => {
        const presets = buildBuyInPresets({ ...table, balanceMicro: usd(500) });
        expect(Math.max(...presets.map(p => Number(p.micro)))).toBe(10_000_000);
        const poor = buildBuyInPresets({ ...table, balanceMicro: usd(3) });
        expect(poor.every(p => p.micro <= usd(3))).toBe(true);
    });

    it("offers Min, 50 BB, 100 BB and Max when all fit", () => {
        const presets = buildBuyInPresets({ minMicro: usd(1), maxMicro: usd(10), bigBlindMicro: usd(0.05), balanceMicro: usd(50) });
        expect(presets.map(p => p.label)).toEqual(["Min", "50 BB", "100 BB", "Max"]);
        expect(presets.map(p => p.micro)).toEqual([usd(1), usd(2.5), usd(5), usd(10)]);
    });

    it("drops stops below the minimum", () => {
        const presets = buildBuyInPresets({ minMicro: usd(4), maxMicro: usd(10), bigBlindMicro: usd(0.02), balanceMicro: usd(50) });
        expect(presets.map(p => p.label)).toEqual(["Min", "Max"]);
    });

    it("keeps the later label when two stops land on the same amount", () => {
        const presets = buildBuyInPresets({ minMicro: usd(1), maxMicro: usd(2), bigBlindMicro: usd(0.02), balanceMicro: usd(50) });
        expect(presets.map(p => p.label)).toEqual(["50 BB", "Max"]);
        expect(presets.map(p => p.micro)).toEqual([usd(1), usd(2)]);
    });

    it("returns nothing when the balance is below the minimum", () => {
        expect(buildBuyInPresets({ ...table, balanceMicro: usd(1) })).toEqual([]);
    });

    it("skips blind-based stops when the big blind is zero", () => {
        const presets = buildBuyInPresets({ minMicro: usd(1), maxMicro: usd(10), bigBlindMicro: 0n, balanceMicro: usd(50) });
        expect(presets.map(p => p.label)).toEqual(["Min", "Max"]);
    });
});
