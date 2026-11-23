import { buildSessionQuery } from "./Api";

describe("buildSessionQuery", () => {
    it("sends the page alone when there's no filter", () => {
        expect(buildSessionQuery(20, 40, {})).toBe("?limit=20&offset=40");
    });

    it("adds the format and variant filter", () => {
        expect(buildSessionQuery(20, 0, { game_format: "sit-and-go", game_variant: "texas-holdem" })).toBe(
            "?limit=20&offset=0&game_format=sit-and-go&game_variant=texas-holdem"
        );
    });

    it("leaves out empty filter fields", () => {
        expect(buildSessionQuery(20, 0, { game_format: "cash", game_variant: "" })).toBe("?limit=20&offset=0&game_format=cash");
    });
});
