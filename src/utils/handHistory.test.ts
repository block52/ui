import { AxiosError } from "axios";
import { GameFormat } from "@block52/poker-vm-sdk";
import { describeHandLoadError, describeHandOutcome, describeIndexing, handKey, indexerErrorCode, mergeHandPages } from "./handHistory";
import type { PlayerHand } from "../types/players";
import type { IndexerStatus } from "../pages/explorer/types";

const hand = (game_id: string, hand_number: number, extra: Partial<PlayerHand> = {}): PlayerHand => ({
    game_id,
    hand_number,
    seat: 1,
    status: "folded",
    won_amount: 0,
    block_height: 100,
    community_cards: [],
    winner_count: 1,
    ...extra
});

const status = (extra: Partial<IndexerStatus> = {}): IndexerStatus => ({
    total_blocks: 470481,
    blocks_indexed: 87600,
    percent_complete: 18.6,
    last_block_indexed: 87600,
    first_block_indexed: 1,
    total_hands: 902,
    total_games: 4,
    ...extra
});

const networkError = () => new AxiosError("Network Error", "ERR_NETWORK");

describe("handHistory (ui#721)", () => {
    describe("mergeHandPages", () => {
        it("appends a page and drops rows already shown (offsets shift when new hands are indexed)", () => {
            const first = [hand("0xa", 3), hand("0xa", 2)];
            const next = [hand("0xa", 2), hand("0xa", 1), hand("0xb", 2)];
            expect(mergeHandPages(first, next).map(handKey)).toEqual(["0xa#3", "0xa#2", "0xa#1", "0xb#2"]);
        });
    });

    describe("describeHandOutcome", () => {
        it("shows SNG and tournament winnings in chips", () => {
            expect(describeHandOutcome({ status: "showing", won_amount: 120 }, GameFormat.SIT_AND_GO)).toEqual({ label: "Won 120 chips", tone: "won" });
            expect(describeHandOutcome({ status: "active", won_amount: 3000 }, GameFormat.TOURNAMENT).label).toBe(`Won ${(3000).toLocaleString()} chips`);
        });

        it("shows cash winnings in USDC", () => {
            expect(describeHandOutcome({ status: "active", won_amount: 400000 }, GameFormat.CASH)).toEqual({ label: "Won $0.40", tone: "won" });
        });

        it("shows a win without units while the table's format is unknown", () => {
            expect(describeHandOutcome({ status: "active", won_amount: 120 }, undefined).label).toBe("Won 120");
        });

        it("names folds, busts, losses and players who left", () => {
            expect(describeHandOutcome({ status: "folded", won_amount: 0 }, GameFormat.CASH)).toEqual({ label: "Folded", tone: "neutral" });
            expect(describeHandOutcome({ status: "busted", won_amount: 0 }, GameFormat.SIT_AND_GO)).toEqual({ label: "Busted", tone: "lost" });
            expect(describeHandOutcome({ status: "showing", won_amount: 0 }, GameFormat.CASH)).toEqual({ label: "Lost", tone: "lost" });
            expect(describeHandOutcome({ status: "", won_amount: 0 }, GameFormat.CASH)).toEqual({ label: "Left the table", tone: "neutral" });
        });
    });

    describe("describeIndexing", () => {
        it("discloses the indexing delay while catching up", () => {
            const text = describeIndexing(status());
            expect(text).toContain(`up to block ${(87600).toLocaleString()} of ${(470481).toLocaleString()}`);
            expect(text).toContain("18.6%");
            expect(text).toContain("Newer hands appear");
        });

        it("says it's up to date once caught up", () => {
            expect(describeIndexing(status({ percent_complete: 100, last_block_indexed: 470481 }))).toContain("up to date");
        });

        it("discloses a retention gap when indexing didn't start at block 1", () => {
            expect(describeIndexing(status({ first_block_indexed: 5000 }))).toContain(`Hands before block ${(5000).toLocaleString()} aren't indexed.`);
        });
    });

    describe("describeHandLoadError", () => {
        it("says the indexer is unreachable on a network error", () => {
            expect(describeHandLoadError(networkError(), "9", null)).toContain("can't be reached");
        });

        it("says a 404 hand isn't indexed yet while the indexer is behind", () => {
            const text = describeHandLoadError({ error: "Hand not found", code: 404 }, "9", status());
            expect(text).toContain("Hand #9 isn't indexed yet");
            expect(text).toContain("18.6%");
        });

        it("says a 404 hand isn't in the history once the indexer is caught up (or its progress is unknown)", () => {
            expect(describeHandLoadError({ code: 404 }, "9", status({ percent_complete: 100 }))).toContain("isn't in the hand history");
            expect(describeHandLoadError({ code: 404 }, "9", null)).toContain("isn't in the hand history");
        });

        it("passes other errors through", () => {
            expect(describeHandLoadError({ error: "Database error", code: 500 }, "9", null)).toBe("Hand #9 couldn't be loaded: Database error");
        });
    });

    it("indexerErrorCode reads the code from an indexer error body only", () => {
        expect(indexerErrorCode({ code: 404 })).toBe(404);
        expect(indexerErrorCode(new Error("x"))).toBeUndefined();
        expect(indexerErrorCode(null)).toBeUndefined();
    });
});
