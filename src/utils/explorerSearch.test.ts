import { explorerSearchPath } from "./explorerSearch";

describe("explorerSearchPath", () => {
    it("returns null for blank input", () => {
        expect(explorerSearchPath("")).toBeNull();
        expect(explorerSearchPath("   ")).toBeNull();
    });

    it("routes digits to a block, trimming and dropping leading zeros", () => {
        expect(explorerSearchPath(" 490304 ")).toBe("/explorer/block/490304");
        expect(explorerSearchPath("007")).toBe("/explorer/block/7");
        expect(explorerSearchPath("0")).toBe("/explorer/block/0");
    });

    it("routes a b52 prefix to an address, lower-cased", () => {
        expect(explorerSearchPath("B521abc")).toBe("/explorer/address/b521abc");
        expect(explorerSearchPath("b521xyz")).toBe("/explorer/address/b521xyz");
    });

    it("routes anything else to a tx hash", () => {
        expect(explorerSearchPath("A1B2c3")).toBe("/explorer/tx/A1B2c3");
        expect(explorerSearchPath("ABCDEF")).toBe("/explorer/tx/ABCDEF");
    });

    it("routes a 64-hex hash to a tx even when it starts with b52, in either case", () => {
        const lower = `b52f1a${"0".repeat(58)}`;
        const upper = `B52F1A${"0".repeat(58)}`;
        expect(explorerSearchPath(lower)).toBe(`/explorer/tx/${lower}`);
        expect(explorerSearchPath(upper)).toBe(`/explorer/tx/${upper}`);
    });

    it("drops a 0x prefix from a 64-hex hash", () => {
        const hash = `b52${"a".repeat(61)}`;
        expect(explorerSearchPath(`0x${hash}`)).toBe(`/explorer/tx/${hash}`);
    });

    it("still routes a full b52 bech32 address to an address", () => {
        const address = "b521glxsr7paju38qdq9gyvd6kqw5tzvwyxp9f";
        expect(explorerSearchPath(address)).toBe(`/explorer/address/${address}`);
    });
});
