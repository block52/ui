import {
    floorPrizeCents,
    flooredPrizesWithinPool,
    formatFlooredPrizeDollars,
    parsePrizeMicro,
    prizeMicroIsPositive
} from "./prizeDisplay";

describe("prizeDisplay", () => {
    it("floors the Bitcoin Bubble places and the net pool down to cents", () => {
        expect(formatFlooredPrizeDollars(25200n)).toBe("0.02");
        expect(formatFlooredPrizeDollars(10800n)).toBe("0.01");
        expect(formatFlooredPrizeDollars(36000n)).toBe("0.03");
        expect(flooredPrizesWithinPool(["25200", "10800"])).toBe(true);
    });

    it("leaves an exact cent amount unchanged", () => {
        expect(formatFlooredPrizeDollars(400000n)).toBe("0.40");
        expect(formatFlooredPrizeDollars(1000000n)).toBe("1.00");
        expect(formatFlooredPrizeDollars(100000000n)).toBe("100.00");
    });

    it("labels a positive sub-cent prize as $0.00 without treating it as zero", () => {
        expect(formatFlooredPrizeDollars(1n)).toBe("0.00");
        expect(prizeMicroIsPositive("1")).toBe(true);
        expect(prizeMicroIsPositive("0")).toBe(false);
        expect(prizeMicroIsPositive("00")).toBe(false);
    });

    it("floors zero and rejects a non-integer amount", () => {
        expect(formatFlooredPrizeDollars(0n)).toBe("0.00");
        expect(floorPrizeCents(0n)).toBe(0n);
        expect(parsePrizeMicro("")).toBeNull();
        expect(parsePrizeMicro("0.0252")).toBeNull();
        expect(parsePrizeMicro(undefined)).toBeNull();
        expect(parsePrizeMicro("nope")).toBeNull();
    });

    it("keeps integer precision past the float range", () => {
        const micro = "9007199254740993000001";
        expect(parsePrizeMicro(micro)?.toString()).toBe(micro);
        expect(formatFlooredPrizeDollars(BigInt(micro))).toBe("9,007,199,254,740,993.00");
    });

    it("lets individual floors fall short of the floored pool and never exceed it", () => {
        expect(flooredPrizesWithinPool(["19999", "19999"])).toBe(true);
        expect(floorPrizeCents(19999n) + floorPrizeCents(19999n)).toBe(2n);
        expect(floorPrizeCents(39998n)).toBe(3n);
        expect(flooredPrizesWithinPool(["25200", "10800", "0"])).toBe(true);
    });
});
