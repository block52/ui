import { GameFormat, formatGameFormatDisplay } from "@block52/poker-vm-sdk";
import { CREATE_GAME_TYPES, createGameTypeFormat, createGameTypeLabel, displayGameFormat, isScheduledCreateType, toCreateGameType } from "./createGameType";

describe("createGameType (ui#823)", () => {
    it("offers the three types a player can create", () => {
        expect(CREATE_GAME_TYPES).toEqual(["sit-and-go", "cash", "tournament"]);
        expect(CREATE_GAME_TYPES.map(createGameTypeLabel)).toEqual(["Sit & Go", "Cash Game", "Tournament"]);
    });

    it("coerces select values and rejects anything else", () => {
        expect(toCreateGameType("tournament")).toBe("tournament");
        expect(toCreateGameType("cash")).toBe("cash");
        expect(toCreateGameType("sit-and-go")).toBe("sit-and-go");
        expect(toCreateGameType("mtt")).toBeUndefined();
        expect(toCreateGameType(undefined)).toBeUndefined();
    });

    it("creates a Tournament as a sit-and-go on chain — the only format the chain accepts for it today", () => {
        expect(createGameTypeFormat("tournament")).toBe(GameFormat.SIT_AND_GO);
        expect(createGameTypeFormat("sit-and-go")).toBe(GameFormat.SIT_AND_GO);
        expect(createGameTypeFormat("cash")).toBe(GameFormat.CASH);
    });

    it("only a Tournament carries a start time", () => {
        expect(isScheduledCreateType("tournament")).toBe(true);
        expect(isScheduledCreateType("sit-and-go")).toBe(false);
        expect(isScheduledCreateType("cash")).toBe(false);
    });

    describe("displayGameFormat", () => {
        it("calls a scheduled sit-and-go a Tournament", () => {
            expect(displayGameFormat(GameFormat.SIT_AND_GO, 1_700_000_000_000, formatGameFormatDisplay)).toBe("Tournament");
        });

        it("leaves an unscheduled sit-and-go, a cash game and a legacy tournament to the SDK label", () => {
            expect(displayGameFormat(GameFormat.SIT_AND_GO, undefined, formatGameFormatDisplay)).toBe(formatGameFormatDisplay(GameFormat.SIT_AND_GO));
            expect(displayGameFormat(GameFormat.SIT_AND_GO, 0, formatGameFormatDisplay)).toBe(formatGameFormatDisplay(GameFormat.SIT_AND_GO));
            expect(displayGameFormat(GameFormat.CASH, 1_700_000_000_000, formatGameFormatDisplay)).toBe(formatGameFormatDisplay(GameFormat.CASH));
            expect(displayGameFormat(GameFormat.TOURNAMENT, undefined, formatGameFormatDisplay)).toBe(formatGameFormatDisplay(GameFormat.TOURNAMENT));
        });

        it("is empty with no format", () => {
            expect(displayGameFormat(null, 1, formatGameFormatDisplay)).toBe("");
            expect(displayGameFormat(undefined, 1, formatGameFormatDisplay)).toBe("");
        });
    });
});
