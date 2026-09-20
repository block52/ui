import { parseTxVerdict } from "./txVerdict";

const HASH = "66F241A333AA1376F9CF85291DE14DCBE07710969E4F4714A9DB7EBAF97C5468";

describe("parseTxVerdict", () => {
    it("reads an executed tx (code 0)", () => {
        expect(parseTxVerdict({ tx_response: { txhash: HASH, code: 0, raw_log: "", height: "277014" } }, HASH)).toEqual({
            hash: HASH,
            code: 0,
            rawLog: "",
            height: 277014
        });
    });

    it("reads a tx that executed and FAILED, keeping the chain's reason", () => {
        const verdict = parseTxVerdict({ tx_response: { txhash: HASH, code: 5, codespace: "sdk", raw_log: "insufficient funds", height: 12 } }, HASH);
        expect(verdict).toEqual({ hash: HASH, code: 5, rawLog: "insufficient funds", height: 12 });
    });

    it("falls back to the requested hash when the response omits one", () => {
        expect(parseTxVerdict({ tx_response: { code: 0, raw_log: "" } }, HASH)?.hash).toBe(HASH);
    });

    it("yields no verdict without an execution code — never an assumed success", () => {
        expect(parseTxVerdict({ tx_response: { txhash: HASH } }, HASH)).toBeNull();
        expect(parseTxVerdict({ code: 5, message: "tx not found" }, HASH)).toBeNull();
        expect(parseTxVerdict(null, HASH)).toBeNull();
        expect(parseTxVerdict("not json", HASH)).toBeNull();
    });
});
