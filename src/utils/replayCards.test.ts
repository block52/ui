import type { PlayerDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import {
    knownHoleCardsKey,
    mergeKnownHoleCards,
    overlayKnownHoleCards,
    ownHoleCards,
    parseBlockTime,
    revealedHoleCards
} from "./replayCards";

const player = (address: string, holeCards: string[] | undefined, status = "active"): PlayerDTO =>
    ({ address, seat: 1, holeCards, status } as unknown as PlayerDTO);

const state = (players: PlayerDTO[]): TexasHoldemStateDTO => ({ handNumber: 3, players } as unknown as TexasHoldemStateDTO);

describe("revealedHoleCards", () => {
    it("collects only real hands, keyed by lower-cased address", () => {
        const known = revealedHoleCards(
            state([
                player("B52Hero", ["AS", "KD"], "showing"),
                player("b52masked", ["X", "X"]),
                player("b52quest", ["??", "??"]),
                player("b52none", []),
                player("b52undef", undefined)
            ])
        );
        expect([...known.entries()]).toEqual([["b52hero", ["AS", "KD"]]]);
    });

    it("is empty for no state", () => {
        expect(revealedHoleCards(null).size).toBe(0);
        expect(revealedHoleCards(undefined).size).toBe(0);
    });
});

describe("ownHoleCards", () => {
    const s = state([player("b52hero", ["AS", "KD"]), player("b52villain", ["X", "X"])]);
    it("finds the address's real cards regardless of case", () => {
        expect(ownHoleCards(s, "B52HERO")).toEqual(["AS", "KD"]);
    });
    it("is null when masked, absent or no address", () => {
        expect(ownHoleCards(s, "b52villain")).toBeNull();
        expect(ownHoleCards(s, "b52nobody")).toBeNull();
        expect(ownHoleCards(s, null)).toBeNull();
    });
});

describe("overlayKnownHoleCards", () => {
    const known = new Map([
        ["b52hero", ["AS", "KD"]],
        ["b52villain", ["7C", "7D"]]
    ]);

    it("replaces masked hands of known players and leaves everything else alone", () => {
        const before = state([
            player("b52hero", ["X", "X"]),
            player("B52Villain", ["??", "??"]),
            player("b52other", ["X", "X"]),
            player("b52waiting", [])
        ]);
        const after = overlayKnownHoleCards(before, known);
        expect(after).not.toBe(before);
        expect(after.players.map(p => p.holeCards)).toEqual([["AS", "KD"], ["7C", "7D"], ["X", "X"], []]);
        // Untouched players keep their identity; the source state is not mutated.
        expect(after.players[2]).toBe(before.players[2]);
        expect(before.players[0].holeCards).toEqual(["X", "X"]);
    });

    it("never overwrites cards that are already real", () => {
        const before = state([player("b52hero", ["QS", "QD"], "showing")]);
        expect(overlayKnownHoleCards(before, known)).toBe(before);
    });

    it("returns the same state when nothing is known or nobody is seated", () => {
        const before = state([player("b52hero", ["X", "X"])]);
        expect(overlayKnownHoleCards(before, new Map())).toBe(before);
        expect(overlayKnownHoleCards(state([]), known)).toEqual(state([]));
    });
});

describe("mergeKnownHoleCards / knownHoleCardsKey", () => {
    it("merges with later entries winning and keys independent of insertion order", () => {
        const a = new Map([["b52x", ["AS", "AD"]]]);
        const b = new Map([
            ["b52y", ["2C", "3C"]],
            ["b52x", ["KS", "KD"]]
        ]);
        const merged = mergeKnownHoleCards(a, b);
        expect(merged.get("b52x")).toEqual(["KS", "KD"]);
        expect(knownHoleCardsKey(merged)).toBe("b52x=KS,KD|b52y=2C,3C");
        expect(knownHoleCardsKey(mergeKnownHoleCards(b, new Map([["b52x", ["KS", "KD"]]])))).toBe(knownHoleCardsKey(merged));
        expect(knownHoleCardsKey(new Map())).toBe("");
    });
});

describe("parseBlockTime", () => {
    const block = (time: unknown) => ({ result: { block: { header: { time } } } });

    it("reads CometBFT's nanosecond RFC 3339 time as Unix seconds", () => {
        expect(parseBlockTime(block("2026-10-19T01:02:03.123456789Z"))).toBe(Date.UTC(2026, 9, 19, 1, 2, 3) / 1000);
        expect(parseBlockTime(block("2026-10-19T01:02:03Z"))).toBe(Date.UTC(2026, 9, 19, 1, 2, 3) / 1000);
        expect(parseBlockTime(block("2026-10-19T11:02:03+10:00"))).toBe(Date.UTC(2026, 9, 19, 1, 2, 3) / 1000);
    });

    it("rejects missing or malformed times", () => {
        expect(() => parseBlockTime({})).toThrow("no header time");
        expect(() => parseBlockTime(block("yesterday"))).toThrow("Unrecognised block time");
        expect(() => parseBlockTime(block(12))).toThrow("no header time");
    });
});
