import type { PlayerSession } from "../types/players";
import type { PlayerPrizeClaim } from "./playerPrizeClaims";
import type { PlayerTournamentEntry, TournamentRegistration, TournamentUnregistration } from "./playerTournamentEntries";
import {
    addedTournamentBuyIns,
    addedTournamentCashOuts,
    claimsForTournament,
    playerListWithAllVariants,
    profileMoneyWithAllVariants,
    sessionCoversTournament
} from "./profileStatsMoney";
import type { PlayerListItem } from "../types/players";

const PLAYER = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";
const CASH = "0x03dbba56a9a50bd607599b6fab0fc94649498ea08771047e8a3a1483979fc685";
const SNG = "0xc2d776e6261a15594d50c8861cd1d75c27793e7a624ead6ba35ad0db73c4aca4";
const MTT = "0x8d34bcce49c988106bba58a5052c3ecf9a6532f142e19dcfba4230ea3ff8a872";
const MTT2 = "0x73751f1291e04944194f347071e5b3f135ae9ea9f2e56766b4ce1e8cb20484ad";

const session = (overrides: Partial<PlayerSession> = {}): PlayerSession => ({
    player_address: PLAYER,
    game_id: CASH,
    join_block: 10,
    buy_in_amount: 1_000_000,
    cash_out_amount: 1_100_000,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides
});

const claim = (overrides: Partial<PlayerPrizeClaim> = {}): PlayerPrizeClaim => ({
    gameId: SNG,
    amount: 6_240_000,
    height: 1011858,
    txhash: "PRIZE",
    ...overrides
});

const registration = (overrides: Partial<TournamentRegistration> = {}): TournamentRegistration => ({
    tournamentId: MTT,
    height: 1_107_713,
    buyIn: 2_000_000,
    entryFee: 200_000,
    ...overrides
});

const entry = (overrides: Partial<PlayerTournamentEntry> = {}): PlayerTournamentEntry => ({
    tournamentId: MTT,
    registerHeight: 1_107_713,
    buyIn: 2_200_000,
    gameId: `${MTT}-t1`,
    status: "finished",
    results: [{ place: 6, playerId: PLAYER, payout: "0" }],
    ...overrides
});

const unreg = (overrides: Partial<TournamentUnregistration> = {}): TournamentUnregistration => ({
    tournamentId: MTT2,
    height: 1_091_316,
    txhash: "UNREG",
    refund: 1_600_000,
    ...overrides
});

const indexer = { totalBuyIns: 67_200_000, totalCashOuts: 20_387_800, netProfit: -46_812_200 };

describe("sessionCoversTournament", () => {
    it("treats a tournament table session as already listed", () => {
        expect(sessionCoversTournament([session({ game_id: `${MTT}-t2` })], MTT)).toBe(true);
        expect(sessionCoversTournament([session({ game_id: CASH })], MTT)).toBe(false);
    });
});

describe("addedTournamentBuyIns", () => {
    it("adds buy-in plus entry fee for every MTT registration the indexer missed", () => {
        expect(
            addedTournamentBuyIns(
                [session()],
                [registration(), registration({ tournamentId: MTT2, height: 1_091_542, buyIn: 2_000_000, entryFee: 200_000 })],
                [entry(), entry({ tournamentId: MTT2, buyIn: 2_200_000, gameId: `${MTT2}-t1` })]
            )
        ).toBe(4_400_000);
    });

    it("counts a second registration of the same tournament and ignores one already in a session", () => {
        expect(
            addedTournamentBuyIns(
                [session({ game_id: `${MTT}-t1` })],
                [registration(), registration({ height: 1_107_800, buyIn: 2_000_000, entryFee: 200_000 })],
                [entry()]
            )
        ).toBe(0);
        expect(
            addedTournamentBuyIns(
                [session()],
                [registration(), registration({ height: 1_107_800, buyIn: 2_000_000, entryFee: 200_000 })],
                [entry()]
            )
        ).toBe(4_400_000);
    });

    it("falls back to entry buy-ins when registrations were not loaded", () => {
        expect(addedTournamentBuyIns([session()], [], [entry(), entry({ tournamentId: MTT2, buyIn: 10_000, gameId: `${MTT2}-t1` })])).toBe(2_210_000);
    });
});

describe("addedTournamentCashOuts", () => {
    it("adds an unregister refund and a paid MTT finish, without a 0 payout", () => {
        const paid = entry({
            results: [{ place: 1, playerId: PLAYER, payout: "6400000" }]
        });
        expect(addedTournamentCashOuts([session()], [], [entry(), paid], [unreg()], PLAYER)).toBe(8_000_000);
    });

    it("does not add an MTT payout already present as a prize claim or session", () => {
        const paid = entry({ results: [{ place: 1, playerId: PLAYER, payout: "6400000" }] });
        expect(
            addedTournamentCashOuts(
                [session()],
                [claim({ gameId: `${MTT}-t1`, amount: 6_400_000, txhash: "MTTPRIZE" })],
                [paid],
                [],
                PLAYER
            )
        ).toBe(0);
        expect(addedTournamentCashOuts([session({ game_id: `${MTT}-t1`, cash_out_amount: 6_400_000 })], [], [paid], [], PLAYER)).toBe(0);
    });
});

describe("claimsForTournament", () => {
    it("sums claims on any table of the tournament", () => {
        expect(claimsForTournament([claim({ gameId: `${MTT}-t2`, amount: 100 }), claim()], MTT)).toBe(100);
    });
});

describe("profileMoneyWithAllVariants", () => {
    it("keeps cash and Sit & Go indexer totals and adds prize claims plus MTT buy-ins", () => {
        const sngSession = session({ game_id: SNG, buy_in_amount: 2_000_000, cash_out_amount: 0, leave_block: undefined });
        const money = profileMoneyWithAllVariants(
            indexer,
            [session(), sngSession],
            [claim()],
            [
                entry(),
                entry({
                    tournamentId: MTT2,
                    buyIn: 2_200_000,
                    gameId: `${MTT2}-t1`,
                    results: [{ place: 7, playerId: PLAYER, payout: "0" }]
                })
            ],
            [registration(), registration({ tournamentId: MTT2, height: 1_091_542 })],
            [],
            PLAYER
        );
        // Prize 6.24 is added (indexer stored 0). Two $2.20 MTT buy-ins. No MTT payouts.
        expect(money).toEqual({
            totalBuyIns: 71_600_000,
            totalCashOuts: 26_627_800,
            netProfit: -44_972_200
        });
    });

    it("adds an unregister refund to cash-out and net, and a cancelled registration to buy-in only when unrefunded", () => {
        const cancelled = "0x2d5b0fc4d40f7fc9c60965f9292d0d96d8c8353e2cbd02c6700fb08a124aa444";
        const money = profileMoneyWithAllVariants(
            { totalBuyIns: 0, totalCashOuts: 0, netProfit: 0 },
            [],
            [],
            [
                entry({
                    tournamentId: cancelled,
                    buyIn: 10_000,
                    gameId: `${cancelled}-t1`,
                    status: "cancelled",
                    results: []
                }),
                entry({
                    tournamentId: MTT2,
                    buyIn: 2_200_000,
                    gameId: `${MTT2}-t1`,
                    status: "registering",
                    results: []
                })
            ],
            [
                registration({ tournamentId: cancelled, buyIn: 10_000, entryFee: 0 }),
                registration({ tournamentId: MTT2 })
            ],
            [unreg()],
            PLAYER
        );
        expect(money).toEqual({
            totalBuyIns: 2_210_000,
            totalCashOuts: 1_600_000,
            netProfit: -610_000
        });
    });

    it("does not double-count a Sit & Go prize the indexer already recorded as a cash-out", () => {
        const money = profileMoneyWithAllVariants(
            { totalBuyIns: 2_000_000, totalCashOuts: 6_240_000, netProfit: 4_240_000 },
            [session({ game_id: SNG, buy_in_amount: 2_000_000, cash_out_amount: 6_240_000, leave_block: 1011858 })],
            [claim()],
            [],
            [],
            [],
            PLAYER
        );
        expect(money).toEqual({
            totalBuyIns: 2_000_000,
            totalCashOuts: 6_240_000,
            netProfit: 4_240_000
        });
    });
});

const listRow = (player_address: string, net_profit: number): PlayerListItem => ({
    player_address,
    vip_tier: "bronze",
    rakeback_pct: 0,
    total_hands: 0,
    total_actions: 0,
    net_profit,
    total_rake_contributed: 0
});

describe("playerListWithAllVariants", () => {
    it("matches the profile net: indexer plus Sit & Go prizes, MTT buy-ins and a paid finish", () => {
        const paid = "0x522af6f3faa14816649c2e24a6ab3b951d56b5e85f7cb8803fe72f1a0127a80b";
        const dust = "0x3d8336114bf407d45e0102ee62c9ea82b4fe9ae9b71fa00a4d87a3bd8f9d9469";
        const cancelled = "0x2d5b0fc4d40f7fc9c60965f9292d0d96d8c8353e2cbd02c6700fb08a124aa444";
        const early = "0x275a79b9258009e0a1f4f4f4232cefe25262765f0a5c7c3a86040885ffec5187";
        const claims = new Map([[PLAYER, [claim({ amount: 62_588_400, gameId: SNG, txhash: "PRIZES" })]]]);
        const regs = [
            registration({ tournamentId: paid, height: 1_123_929 }),
            registration(),
            registration({ tournamentId: MTT2, height: 1_091_542 }),
            registration({ tournamentId: dust, buyIn: 10_000, entryFee: 0, height: 1_089_793 }),
            registration({ tournamentId: cancelled, buyIn: 10_000, entryFee: 0, height: 1_089_413 }),
            registration({ tournamentId: early, height: 1_059_332 })
        ];
        const bust = (tournamentId: string, height: number, place: number, buyIn = 2_200_000): PlayerTournamentEntry =>
            entry({
                tournamentId,
                registerHeight: height,
                buyIn,
                gameId: `${tournamentId}-t1`,
                results: [{ place, playerId: PLAYER, payout: "0" }]
            });
        const entries = [
            entry({
                tournamentId: paid,
                registerHeight: 1_123_929,
                gameId: `${paid}-t1`,
                results: [{ place: 2, playerId: PLAYER, payout: "5280000" }]
            }),
            bust(MTT, 1_107_713, 6),
            bust(MTT2, 1_091_542, 7),
            bust(dust, 1_089_793, 3, 10_000),
            entry({
                tournamentId: cancelled,
                registerHeight: 1_089_413,
                buyIn: 10_000,
                gameId: `${cancelled}-t1`,
                status: "cancelled",
                results: []
            }),
            bust(early, 1_059_332, 6)
        ];
        const [andrew, other] = playerListWithAllVariants(
            [listRow(PLAYER, -46_812_200), listRow("b521other", 100)],
            claims,
            new Map(),
            new Map([[PLAYER, regs]]),
            new Map([[PLAYER, entries]]),
            new Map()
        );
        // Indexer net -46.8122 + Sit & Go prizes 62.5884 would leave the list at 15.7762.
        // Six MTT buy-ins (4 x 2.20 + 2 x 0.01 = 8.82) and a 5.28 payout bring net to 12.2362.
        expect(andrew.net_profit).toBe(12_236_200);
        expect(other.net_profit).toBe(100);
    });

    it("does not count a Sit & Go prize twice when the indexer already recorded it", () => {
        const [row] = playerListWithAllVariants(
            [listRow(PLAYER, 4_240_000)],
            new Map([[PLAYER, [claim()]]]),
            new Map([
                [
                    PLAYER,
                    [session({ game_id: SNG, buy_in_amount: 2_000_000, cash_out_amount: 6_240_000, leave_block: 1011858 })]
                ]
            ])
        );
        expect(row.net_profit).toBe(4_240_000);
    });
});
