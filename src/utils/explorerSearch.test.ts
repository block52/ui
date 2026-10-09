import { classifyExplorerQuery, explorerSearchPath } from "./explorerSearch";

describe("classifyExplorerQuery", () => {
    it("treats blank input as empty", () => {
        expect(classifyExplorerQuery("   ")).toEqual({ kind: "empty" });
    });

    it("treats digits as a block height, trimming and dropping leading zeros", () => {
        expect(classifyExplorerQuery(" 490304 ")).toEqual({ kind: "block", height: "490304" });
        expect(classifyExplorerQuery("007")).toEqual({ kind: "block", height: "7" });
        expect(classifyExplorerQuery("0")).toEqual({ kind: "block", height: "0" });
    });

    it("treats a b52 prefix as an address, lower-cased", () => {
        expect(classifyExplorerQuery("B521abc")).toEqual({ kind: "address", address: "b521abc" });
    });

    it("treats anything else as a tx hash", () => {
        expect(classifyExplorerQuery("A1B2c3")).toEqual({ kind: "tx", hash: "A1B2c3" });
    });
});

describe("explorerSearchPath", () => {
    it("routes each kind to its page", () => {
        expect(explorerSearchPath("12")).toBe("/explorer/block/12");
        expect(explorerSearchPath("b521xyz")).toBe("/explorer/address/b521xyz");
        expect(explorerSearchPath("ABCDEF")).toBe("/explorer/tx/ABCDEF");
    });

    it("returns null for an empty query", () => {
        expect(explorerSearchPath("")).toBeNull();
    });
});
