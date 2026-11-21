import type { PlayerListItem, PlayerSession } from "../types/players";
import {
    isPrizeClaimAddress,
    isUnsupportedTxQuery,
    playerListWithPrizes,
    prizeClaimsByPlayer,
    prizeClaimsFromTxSearch,
    profileMoneyWithPrizes,
    sessionRowsWithPrizes,
    type PlayerPrizeClaim
} from "./playerPrizeClaims";

const GAME = "0xc2d776e6261a15594d50c8861cd1d75c27793e7a624ead6ba35ad0db73c4aca4";
const PLAYER = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";

const session = (overrides: Partial<PlayerSession> = {}): PlayerSession => ({
    player_address: PLAYER,
    game_id: GAME,
    join_block: 1011013,
    buy_in_amount: 2_000_000,
    cash_out_amount: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides
});

const claim = (overrides: Partial<PlayerPrizeClaim> = {}): PlayerPrizeClaim => ({
    gameId: GAME,
    amount: 6_240_000,
    height: 1011858,
    txhash: "E2AF3A279936DB2C49A61619D90FA73DE0464637F9820FFC9E4A0403B9B4C8AF",
    ...overrides
});

const prizeEvent = (player: string, amount: string, gameId = GAME) => ({
    type: "sng_prize_claimed",
    attributes: [
        { key: "game_id", value: gameId },
        { key: "player", value: player },
        { key: "amount", value: amount }
    ]
});

describe("prizeClaimsFromTxSearch", () => {
    it("ignores a failed transaction and keeps a successful claim", () => {
        const claims = prizeClaimsFromTxSearch(
            {
                tx_responses: [
                    { code: 1113, height: "1011850", txhash: "FAIL", events: [prizeEvent(PLAYER, "999")] },
                    { code: 0, height: "1011858", txhash: claim().txhash, events: [prizeEvent(PLAYER, "6240000")] }
                ]
            },
            PLAYER
        );
        expect(claims).toEqual([claim()]);
    });

    it("ignores a prize paid to someone else", () => {
        const claims = prizeClaimsFromTxSearch(
            { tx_responses: [{ code: 0, height: "12", txhash: "OTHER", events: [prizeEvent("b521other", "100")] }] },
            PLAYER
        );
        expect(claims).toEqual([]);
    });
});

describe("sessionRowsWithPrizes", () => {
    it("sets the cash-out, leave block and prize tx on the matching session", () => {
        const [row] = sessionRowsWithPrizes([session()], [claim()]);
        expect(row).toMatchObject({
            gameId: GAME,
            joinBlock: 1011013,
            leaveBlock: 1011858,
            buyIn: 2_000_000,
            cashOut: 6_240_000,
            isPrize: true,
            prizeTxHash: claim().txhash
        });
    });

    it("matches a re-entry claim to the latest join at or before the claim height", () => {
        const sessions = [session({ join_block: 100, cash_out_amount: 0 }), session({ join_block: 300, cash_out_amount: 0 })];
        const rows = sessionRowsWithPrizes(sessions, [claim({ amount: 80, height: 250, txhash: "EARLY" }), claim({ amount: 90, height: 400, txhash: "LATE" })]);
        // The earlier claim can only see the first buy-in. The later one takes the re-entry.
        expect(rows[0]).toMatchObject({ cashOut: 80, leaveBlock: 250, isPrize: true, prizeTxHash: "EARLY" });
        expect(rows[1]).toMatchObject({ cashOut: 90, leaveBlock: 400, isPrize: true, prizeTxHash: "LATE" });
    });

    it("does not paint one claim onto every join of the game", () => {
        const sessions = [session({ join_block: 100 }), session({ join_block: 300 })];
        const rows = sessionRowsWithPrizes(sessions, [claim({ amount: 80, height: 400, txhash: "ONCE" })]);
        expect(rows[0].cashOut).toBeUndefined();
        expect(rows[0].isPrize).toBe(false);
        expect(rows[1]).toMatchObject({ cashOut: 80, leaveBlock: 400, isPrize: true, prizeTxHash: "ONCE" });
    });

    it("leaves a claim with no indexer row off the table", () => {
        const rows = sessionRowsWithPrizes([session({ game_id: "0xother", cash_out_amount: 0 })], [claim({ gameId: "0xmissing", amount: 280_000 })]);
        expect(rows).toHaveLength(1);
        expect(rows[0].isPrize).toBe(false);
        expect(rows[0].cashOut).toBeUndefined();
    });

    it("leaves cash-out unset for an open row so the page shows an em dash", () => {
        const [row] = sessionRowsWithPrizes([session({ cash_out_amount: 0 })], []);
        expect(row.cashOut).toBeUndefined();
        expect(row.leaveBlock).toBeUndefined();
        expect(row.isPrize).toBe(false);
    });

    it("keeps a real zero when the player left the table", () => {
        const [row] = sessionRowsWithPrizes([session({ leave_block: 20, cash_out_amount: 0, join_block: 10 })], []);
        expect(row.cashOut).toBe(0);
        expect(row.leaveBlock).toBe(20);
    });
});

describe("profileMoneyWithPrizes", () => {
    const money = { totalCashOuts: 18_067_800, netProfit: -42_812_200 };

    it("adds a prize the indexer recorded as 0, once", () => {
        const withPrize = profileMoneyWithPrizes(money, [session()], [claim()]);
        expect(withPrize).toEqual({ totalCashOuts: 18_067_800 + 6_240_000, netProfit: -42_812_200 + 6_240_000 });
    });

    it("does not add a prize the matched session already recorded", () => {
        const sessions = [session({ leave_block: 1011858, cash_out_amount: 6_240_000 })];
        expect(profileMoneyWithPrizes(money, sessions, [claim()])).toEqual(money);
    });

    it("adds a claim whose game has no indexer row, and does not double count the matched one", () => {
        const sessions = [session({ cash_out_amount: 0 })];
        const claims = [claim({ amount: 6_240_000, txhash: "MATCHED" }), claim({ gameId: "0xmissing", amount: 1_600_000, height: 108703, txhash: "ORPHAN" })];
        expect(profileMoneyWithPrizes({ totalCashOuts: 100, netProfit: -50 }, sessions, claims)).toEqual({
            totalCashOuts: 100 + 6_240_000 + 1_600_000,
            netProfit: -50 + 6_240_000 + 1_600_000
        });
        // Two joins must not turn one claim into two cash-outs.
        const reentries = [session({ join_block: 100 }), session({ join_block: 300 })];
        expect(profileMoneyWithPrizes({ totalCashOuts: 0, netProfit: 0 }, reentries, [claim({ amount: 80, height: 400, txhash: "ONCE" })]).totalCashOuts).toBe(
            80
        );
    });
});

const listRow = (player_address: string, net_profit: number): PlayerListItem => ({
    player_address,
    vip_tier: "bronze",
    rakeback_pct: 0,
    total_hands: 1,
    total_actions: 1,
    net_profit,
    total_rake_contributed: 0
});

describe("prizeClaimsByPlayer", () => {
    const other = "b521otherplayer";

    it("groups successful claims by player and drops a failed or repeated tx", () => {
        const body = {
            tx_responses: [
                { code: 1113, height: "10", txhash: "FAIL", events: [prizeEvent(PLAYER, "999")] },
                { code: 0, height: "12", txhash: "A1", events: [prizeEvent(PLAYER, "80")] },
                { code: 0, height: "12", txhash: "A1", events: [prizeEvent(PLAYER, "80")] },
                { code: 0, height: "14", txhash: "B1", events: [prizeEvent(other, "40", "0xother")] }
            ]
        };
        const grouped = prizeClaimsByPlayer(body);
        expect(grouped.get(PLAYER)).toEqual([claim({ amount: 80, height: 12, txhash: "A1" })]);
        expect(grouped.get(other)).toEqual([claim({ gameId: "0xother", amount: 40, height: 14, txhash: "B1" })]);
        expect(prizeClaimsFromTxSearch(body, PLAYER)).toEqual(grouped.get(PLAYER));
    });
});

describe("playerListWithPrizes", () => {
    it("adds a prize the indexer recorded as 0 and leaves everyone else alone", () => {
        const players = [listRow(PLAYER, -1_000), listRow("b521otherplayer", 25)];
        const claims = new Map([[PLAYER, [claim({ amount: 400 })]]]);
        const sessions = new Map([[PLAYER, [session()]]]);
        const [winner, other] = playerListWithPrizes(players, claims, sessions);
        expect(winner.net_profit).toBe(-600);
        expect(other).toBe(players[1]);
    });

    it("does not add a prize the matched session already recorded as a cash-out", () => {
        const players = [listRow(PLAYER, -1_000)];
        const claims = new Map([[PLAYER, [claim({ amount: 6_240_000 })]]]);
        const sessions = new Map([[PLAYER, [session({ leave_block: 1011858, cash_out_amount: 6_240_000 })]]]);
        expect(playerListWithPrizes(players, claims, sessions)[0].net_profit).toBe(-1_000);
    });
});

describe("isUnsupportedTxQuery", () => {
    it("recognises a rejected event query and ignores a transport failure", () => {
        expect(isUnsupportedTxQuery({ code: 13, message: "failed to search for txs" })).toBe(true);
        expect(isUnsupportedTxQuery({ code: 5 })).toBe(false);
        expect(isUnsupportedTxQuery(new Error("offline"))).toBe(false);
    });
});

describe("isPrizeClaimAddress", () => {
    it("accepts a bech32 player address and rejects anything that could break the query", () => {
        expect(isPrizeClaimAddress(PLAYER)).toBe(true);
        expect(isPrizeClaimAddress("b521' OR true")).toBe(false);
        expect(isPrizeClaimAddress(undefined)).toBe(false);
    });
});
