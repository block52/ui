import { profileHistoryHandsPending, profileStyleCardsPending } from "./profileStatsLoading";

const styleBase = {
    onStatsTab: true,
    hasAddress: true,
    handListFailed: false,
    handListComplete: true,
    styleLogsPending: false,
    recoveredSearched: false,
    styleDealt: 0
};

describe("profileStyleCardsPending", () => {
    it("is false off the Stats tab, without an address, or after the hand list fails", () => {
        expect(profileStyleCardsPending({ ...styleBase, onStatsTab: false, handListComplete: false, styleLogsPending: true })).toBe(false);
        expect(profileStyleCardsPending({ ...styleBase, hasAddress: false, handListComplete: false, styleLogsPending: true })).toBe(false);
        expect(profileStyleCardsPending({ ...styleBase, handListFailed: true, handListComplete: false, styleLogsPending: true })).toBe(false);
    });

    it("waits for the indexer list and its chain logs, even while recovered MTT hands are still loading", () => {
        expect(profileStyleCardsPending({ ...styleBase, handListComplete: false })).toBe(true);
        expect(profileStyleCardsPending({ ...styleBase, styleLogsPending: true, recoveredSearched: false })).toBe(true);
        expect(profileStyleCardsPending({ ...styleBase, styleLogsPending: false, recoveredSearched: false, styleDealt: 480 })).toBe(false);
    });

    it("does not return to an ellipsis when recovered hands append to a finished style read", () => {
        expect(
            profileStyleCardsPending({
                ...styleBase,
                styleLogsPending: true,
                recoveredSearched: true,
                styleDealt: 480
            })
        ).toBe(false);
        expect(
            profileStyleCardsPending({
                ...styleBase,
                styleLogsPending: true,
                recoveredSearched: true,
                styleDealt: 0
            })
        ).toBe(true);
    });
});

describe("profileHistoryHandsPending", () => {
    it("is true only while the indexer hand list is still loading on Stats", () => {
        expect(profileHistoryHandsPending({ onStatsTab: true, hasAddress: true, handListFailed: false, handListComplete: false })).toBe(true);
        expect(profileHistoryHandsPending({ onStatsTab: true, hasAddress: true, handListFailed: false, handListComplete: true })).toBe(false);
        expect(profileHistoryHandsPending({ onStatsTab: true, hasAddress: true, handListFailed: true, handListComplete: false })).toBe(false);
        expect(profileHistoryHandsPending({ onStatsTab: false, hasAddress: true, handListFailed: false, handListComplete: false })).toBe(false);
    });
});
