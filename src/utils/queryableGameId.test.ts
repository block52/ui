import { assertQueryableGameId } from "./queryableGameId";

const MTT = "0x275a79b9258009e0a1f4f4f4232cefe25262765f0a5c7c3a86040885ffec5187-t1";

describe("assertQueryableGameId", () => {
    it("allows an alphanumeric id and a multi-table tournament -t suffix", () => {
        expect(() => assertQueryableGameId("0xabc")).not.toThrow();
        expect(() => assertQueryableGameId("0xabc-t1")).not.toThrow();
        expect(() => assertQueryableGameId("0xabc-t12")).not.toThrow();
        expect(() => assertQueryableGameId(MTT)).not.toThrow();
    });

    it("rejects ids that could break out of the query", () => {
        const malicious = [
            "",
            "-t1",
            "0xabc' OR 'x'='x",
            "0xabc' OR 1",
            "0xabc -t1",
            "0xabc-t 1",
            "0xabc;drop",
            "0xabc$(id)",
            "0xabc`id`",
            "0xabc-t1' OR 1=1",
            "0xabc-t",
            "0xabc-T1",
            "0xabc-t1extra",
            "0xabc-t1-t2",
            "../0xabc"
        ];
        for (const gameId of malicious) {
            expect(() => assertQueryableGameId(gameId)).toThrow("Invalid table id");
        }
    });
});
