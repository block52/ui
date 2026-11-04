import type { PlayerHand, PlayerProfile } from "../types/players";
import {
    AWARD_PODIUM_SIZE,
    computeAwards,
    decisionCount,
    handsWithRecordedWinner,
    MIN_AWARD_DECISIONS,
    MIN_AWARD_HANDS,
    PlayerAwardLine,
    rankedLines,
    toAwardLine
} from "./playerAwards";

const line = (address: string, counts: Partial<PlayerAwardLine> = {}): PlayerAwardLine => ({
    address,
    bets: 0,
    raises: 0,
    calls: 0,
    folds: 0,
    checks: 200,
    handsCounted: 0,
    handsWon: 0,
    ...counts
});

const award = (lines: PlayerAwardLine[], id: string) => computeAwards(lines).find(entry => entry.id === id);
const winnerOf = (lines: PlayerAwardLine[], id: string) => award(lines, id)?.podium[0];

const hand = (hand_number: number, won_amount: number, winner_count = 1): PlayerHand => ({
    game_id: "0xa",
    hand_number,
    seat: 1,
    status: "folded",
    won_amount,
    block_height: 1,
    community_cards: [],
    winner_count
});

const profile: PlayerProfile = {
    player_address: "b521me",
    total_hands: 0,
    total_actions: 0,
    total_buy_ins: 0,
    total_cash_outs: 0,
    net_profit: 0,
    session_count: 0,
    avg_session_length: 0,
    vip_tier: "bronze",
    rakeback_pct: 0,
    vip_points: 0,
    total_rake_contributed: 0,
    current_month_rake: 0,
    vpip: 0,
    pfr: 0,
    aggression_factor: 0,
    wtsd: 0,
    won_at_showdown: 0,
    total_bets: 1,
    total_raises: 2,
    total_calls: 3,
    total_folds: 4,
    total_checks: 5,
    biggest_pot_won: 0,
    biggest_hand_profit: 0,
    longest_session_blocks: 0
};

describe("handsWithRecordedWinner", () => {
    it("finds the hands any wallet won chips in", () => {
        const found = handsWithRecordedWinner([hand(1, 100), hand(1, 0), hand(2, 0)]);
        expect([...found]).toEqual(["0xa/1"]);
    });

    it("tells apart the same hand number on different tables", () => {
        const otherTable = { ...hand(1, 100), game_id: "0xb" };
        expect([...handsWithRecordedWinner([otherTable, hand(1, 0)])]).toEqual(["0xb/1"]);
    });

    it("handles no hands", () => {
        expect(handsWithRecordedWinner([]).size).toBe(0);
    });
});

describe("toAwardLine", () => {
    it("reads the action counts from the profile", () => {
        expect(toAwardLine(profile, [], new Set())).toEqual({
            address: "b521me",
            bets: 1,
            raises: 2,
            calls: 3,
            folds: 4,
            checks: 5,
            handsCounted: 0,
            handsWon: 0
        });
    });

    it("counts a hand as won only with chips won", () => {
        const hands = [hand(1, 100), hand(2, 0), hand(3, 0)];
        const { handsCounted, handsWon } = toAwardLine(profile, hands, new Set(["0xa/1", "0xa/2", "0xa/3"]));
        expect(handsCounted).toBe(3);
        expect(handsWon).toBe(1);
    });

    it("leaves out a hand nobody is recorded as winning, which would read as a loss", () => {
        const { handsCounted, handsWon } = toAwardLine(profile, [hand(1, 100), hand(2, 0)], new Set(["0xa/1"]));
        expect(handsCounted).toBe(1);
        expect(handsWon).toBe(1);
    });

    it("keeps a hand everyone folded before the flop, which has a winner but a winner_count of 0", () => {
        const preflopWin = hand(1, 100, 0);
        const preflopFold = hand(1, 0, 0);
        const withWinner = handsWithRecordedWinner([preflopWin, preflopFold]);
        expect(toAwardLine(profile, [preflopWin], withWinner).handsWon).toBe(1);
        expect(toAwardLine(profile, [preflopFold], withWinner).handsCounted).toBe(1);
    });
});

describe("decisionCount", () => {
    it("adds folds, checks, calls, bets and raises", () => {
        expect(decisionCount(line("a", { bets: 1, raises: 2, calls: 3, folds: 4, checks: 5 }))).toBe(15);
    });
});

describe("rankedLines", () => {
    it("needs the minimum number of decisions", () => {
        const enough = line("enough", { checks: MIN_AWARD_DECISIONS });
        const short = line("short", { checks: MIN_AWARD_DECISIONS - 1 });
        expect(rankedLines([enough, short])).toEqual([enough]);
    });
});

describe("computeAwards", () => {
    it("reproduces the article's nit: checks count as decisions", () => {
        const nit = line("nit", { bets: 24, raises: 18, calls: 29, folds: 88, checks: 32 });
        expect(winnerOf([nit], "nit")?.evidence).toBe("Folds 46% of decisions: 88 of 191");
    });

    it("gives the nit award to the biggest share of folds, not the most folds", () => {
        const volume = line("volume", { folds: 500, checks: 1500 });
        const tight = line("tight", { folds: 150, checks: 50 });
        expect(winnerOf([volume, tight], "nit")?.address).toBe("tight");
    });

    it("gives the loosest award to the biggest share of money-in decisions", () => {
        const loose = line("loose", { bets: 25, raises: 28, calls: 88, folds: 30, checks: 57 });
        const passive = line("passive", { calls: 20, checks: 180 });
        const winner = winnerOf([passive, loose], "loosest");
        expect(winner?.address).toBe("loose");
        expect(winner?.evidence).toBe("Money in on 62% of decisions: 141 of 228");
    });

    it("ranks aggression both ways", () => {
        const maniac = line("maniac", { bets: 90, raises: 113, calls: 102 });
        const station = line("station", { bets: 10, raises: 20, calls: 109 });
        expect(winnerOf([station, maniac], "maniac")?.evidence).toBe("Aggression 1.99: 203 bets and raises against 102 calls");
        expect(winnerOf([maniac, station], "station")?.evidence).toBe("Aggression 0.28: 30 bets and raises against 109 calls");
    });

    it("keeps a wallet with too few money actions out of the aggression awards", () => {
        const nit = line("nit", { bets: 9, raises: 8, calls: 4, folds: 156 });
        const maniac = line("maniac", { bets: 90, raises: 113, calls: 102 });
        expect(winnerOf([nit, maniac], "maniac")?.address).toBe("maniac");
        expect(winnerOf([nit], "maniac")).toBeUndefined();
    });

    it("ranks a wallet that never called as the top maniac, and never as the station", () => {
        const neverCalled = line("never-called", { bets: 30, raises: 30 });
        const other = line("other", { bets: 40, raises: 40, calls: 40 });
        const winner = winnerOf([other, neverCalled], "maniac");
        expect(winner?.address).toBe("never-called");
        expect(winner?.stat).toBe("∞");
        expect(winnerOf([other, neverCalled], "station")?.address).toBe("other");
    });

    it("needs the minimum hands for the win-rate awards", () => {
        const boss = line("boss", { handsCounted: MIN_AWARD_HANDS, handsWon: 20 });
        const lucky = line("lucky", { handsCounted: MIN_AWARD_HANDS - 1, handsWon: MIN_AWARD_HANDS - 1 });
        const dead = line("dead", { handsCounted: 35, handsWon: 1 });
        expect(winnerOf([lucky, boss, dead], "boss")?.address).toBe("boss");
        expect(winnerOf([lucky, boss, dead], "card-dead")?.evidence).toBe("Won 1 of 35 hands: 3%");
    });

    it("gives the grinder award to the most decisions", () => {
        const winner = winnerOf([line("short", { checks: 200 }), line("long", { checks: 900 })], "grinder");
        expect(winner?.address).toBe("long");
        expect(winner?.evidence).toBe("900 decisions at the tables");
    });

    it("lists a podium, best first", () => {
        const lines = ["a", "b", "c", "d"].map((address, index) => line(address, { folds: 10 * (index + 1) }));
        const podium = award(lines, "nit")?.podium ?? [];
        expect(podium).toHaveLength(AWARD_PODIUM_SIZE);
        expect(podium.map(entry => entry.address)).toEqual(["d", "c", "b"]);
    });

    it("breaks a tie by the bigger sample, then the address", () => {
        const small = line("small", { folds: 100, checks: 100 });
        const big = line("big", { folds: 200, checks: 200 });
        expect(winnerOf([small, big], "nit")?.address).toBe("big");

        const b = line("b", { folds: 100, checks: 100 });
        const a = line("a", { folds: 100, checks: 100 });
        expect(winnerOf([b, a], "nit")?.address).toBe("a");
    });

    it("doesn't rank wallets under the minimum decisions", () => {
        const folder = line("folder", { folds: MIN_AWARD_DECISIONS - 1, checks: 0 });
        expect(computeAwards([folder])).toEqual([]);
    });

    it("leaves out an award nobody qualifies for", () => {
        const ids = computeAwards([line("a")]).map(entry => entry.id);
        expect(ids).toEqual(["nit", "loosest", "grinder"]);
    });

    it("has no money award, because the indexer doesn't record tournament prizes", () => {
        const everyAward = computeAwards([line("a", { bets: 90, raises: 113, calls: 102, handsCounted: 40, handsWon: 10 })]);
        expect(everyAward.map(entry => entry.id)).toEqual(["nit", "loosest", "maniac", "station", "boss", "card-dead", "grinder"]);
    });

    it("returns nothing for no wallets", () => {
        expect(computeAwards([])).toEqual([]);
    });

    it("doesn't reorder the caller's lines", () => {
        const lines = [line("a", { folds: 1 }), line("b", { folds: 2 })];
        computeAwards(lines);
        expect(lines.map(entry => entry.address)).toEqual(["a", "b"]);
    });
});
