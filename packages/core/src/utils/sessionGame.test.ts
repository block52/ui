import { sessionGameLabel, sessionGameOptions } from "./sessionGame";

describe("sessionGameLabel", () => {
    it("names the format and variant in the app's words", () => {
        expect(sessionGameLabel("cash", "texas-holdem")).toBe("Cash Game · Texas Hold'em");
        expect(sessionGameLabel("sit-and-go", "omaha")).toBe("Sit & Go · Omaha");
        expect(sessionGameLabel("tournament", "texas-holdem")).toBe("Tournament · Texas Hold'em");
    });

    it("gives no label while the indexer hasn't recorded the game", () => {
        expect(sessionGameLabel(undefined, undefined)).toBeUndefined();
        expect(sessionGameLabel("cash", undefined)).toBeUndefined();
        expect(sessionGameLabel(undefined, "omaha")).toBeUndefined();
    });

    it("gives no label for a format or variant this build doesn't know", () => {
        expect(sessionGameLabel("spin-and-go", "texas-holdem")).toBeUndefined();
        expect(sessionGameLabel("cash", "stud")).toBeUndefined();
    });
});

describe("sessionGameOptions", () => {
    it("keeps the indexer's order and builds each entry's filter", () => {
        const options = sessionGameOptions([
            { game_format: "sit-and-go", game_variant: "texas-holdem", sessions: 12 },
            { game_format: "cash", game_variant: "omaha", sessions: 3 }
        ]);
        expect(options).toEqual([
            {
                key: "sit-and-go:texas-holdem",
                label: "Sit & Go · Texas Hold'em",
                sessions: 12,
                filter: { game_format: "sit-and-go", game_variant: "texas-holdem" }
            },
            { key: "cash:omaha", label: "Cash Game · Omaha", sessions: 3, filter: { game_format: "cash", game_variant: "omaha" } }
        ]);
    });

    it("leaves out kinds it can't name", () => {
        expect(sessionGameOptions([{ game_format: "spin-and-go", game_variant: "texas-holdem", sessions: 1 }])).toEqual([]);
    });

    it("has no entries on an indexer without the counts", () => {
        expect(sessionGameOptions(undefined)).toEqual([]);
        expect(sessionGameOptions([])).toEqual([]);
    });
});
