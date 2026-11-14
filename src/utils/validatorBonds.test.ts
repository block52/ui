import { toValidatorBonds } from "./validatorBonds";

describe("toValidatorBonds", () => {
    it("maps operator_address and tokens onto validator and bondedUsdc", () => {
        expect(toValidatorBonds([{ operator_address: "b52valoper1aaa", tokens: "10000000" }])).toEqual([
            { validator: "b52valoper1aaa", bondedUsdc: "10000000" }
        ]);
    });

    it("keeps the order of the reply", () => {
        const out = toValidatorBonds([
            { operator_address: "b", tokens: "2" },
            { operator_address: "a", tokens: "1" }
        ]);
        expect(out.map(b => b.validator)).toEqual(["b", "a"]);
    });

    it("drops entries missing an address or tokens, without filling them in", () => {
        expect(
            toValidatorBonds([{ operator_address: "b52valoper1aaa" }, { tokens: "5" }, { operator_address: "", tokens: "5" }, { operator_address: "x", tokens: "" }])
        ).toEqual([]);
    });

    it("returns an empty list for a reply with no validators", () => {
        expect(toValidatorBonds(undefined)).toEqual([]);
        expect(toValidatorBonds([])).toEqual([]);
    });

    it("keeps a zero-token validator, which is still bonded data", () => {
        expect(toValidatorBonds([{ operator_address: "a", tokens: "0" }])).toEqual([{ validator: "a", bondedUsdc: "0" }]);
    });
});
