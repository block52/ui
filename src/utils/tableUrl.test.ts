import { tableUrl } from "./tableUrl";

describe("tableUrl", () => {
    it("routes a game id to its table page", () => {
        expect(tableUrl("0xabc-t2")).toBe("/table/0xabc-t2");
    });
});
