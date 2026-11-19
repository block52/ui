import type { TournamentStateDTO } from "../types/tournament";
import { sessionBustFor, sessionLeaveBlock } from "./sessionBust";
import { sessionGameLabel } from "./sessionGameDisplay";
import { settledSessionCashOut, variantMoneyFromRows } from "./profileHistoryStats";
import type { SessionPrizeRow } from "./playerPrizeClaims";
import {
    earliestRegistrations,
    firstTournamentTableGameId,
    mergeTournamentSessionRows,
    tableGameIdsOf,
    tournamentTableGameIds,
    readTournamentRecord,
    registrationBuyIn,
    sessionMetasWithTournamentEntries,
    tournamentEntryFromRegistration,
    tournamentFinishPlaceLabel,
    tournamentEntriesByPlayer,
    tournamentRegisteredQuery,
    tournamentRegistrationsByPlayer,
    tournamentRegistrationsFromTxSearch,
    tournamentSessionCashOut,
    tournamentUnregistrationsByPlayer,
    tournamentUnregistrationsFromTxSearch,
    uniqueTournamentIds,
    withTournamentHandLeaveBlocks,
    withTournamentRefunds,
    type PlayerTournamentEntry,
    type TournamentRegistration
} from "./playerTournamentEntries";

const PLAYER = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";
const TID = "0x275a79b9258009e0a1f4f4f4232cefe25262765f0a5c7c3a86040885ffec5187";
const REGISTERED_AT = 1_059_332;

function registration(overrides: Partial<TournamentRegistration> = {}): TournamentRegistration {
    return { tournamentId: TID, height: REGISTERED_AT, buyIn: 2_000_000, entryFee: 200_000, ...overrides };
}

function state(overrides: Partial<TournamentStateDTO> = {}): TournamentStateDTO {
    return {
        tournamentId: TID,
        status: "finished",
        level: 3,
        options: {
            buyIn: "2000000",
            entryFee: "200000",
            startingStack: "5000",
            seatsPerTable: 9,
            minEntrants: 6,
            maxEntrants: 27,
            startTime: 1,
            blindStructure: { levels: [] },
            actionTimeoutSeconds: 30
        },
        entrants: [],
        tables: [{ tableId: `${TID}/t1`, ordinal: 1, players: [], broken: false, handNumber: 63, atBoundary: true }],
        prizePool: "11200000",
        payouts: [],
        results: [{ place: 6, playerId: PLAYER, payout: "0" }],
        seq: 1,
        ...overrides
    } as TournamentStateDTO;
}

function tx(code: number, height: string, buyIn = "2000000", entryFee = "200000", tournamentId = TID) {
    return {
        code,
        height,
        txhash: "ABC",
        events: [
            {
                type: "tournament_registered",
                attributes: [
                    { key: "tournament_id", value: tournamentId },
                    { key: "player", value: PLAYER },
                    { key: "buy_in", value: buyIn },
                    { key: "entry_fee", value: entryFee }
                ]
            }
        ]
    };
}

function entryFrom(overrides: Partial<TournamentStateDTO> = {}, reg: Partial<TournamentRegistration> = {}): PlayerTournamentEntry {
    const built = tournamentEntryFromRegistration(registration(reg), state(overrides), PLAYER);
    if (!built) throw new Error("expected a tournament entry");
    return built;
}

const indexerRow = (gameId: string): SessionPrizeRow => ({ gameId, joinBlock: 10, buyIn: 1, cashOut: 0, isPrize: false });

describe("tournament registrations", () => {
    it("reads the tournament, the register height, and buy-in plus entry fee", () => {
        expect(tournamentRegisteredQuery(PLAYER)).toBe(`tournament_registered.player='${PLAYER}'`);
        const found = tournamentRegistrationsFromTxSearch({ tx_responses: [tx(0, "1059332"), tx(1, "1059000")] }, PLAYER);
        expect(found).toEqual([{ tournamentId: TID, height: REGISTERED_AT, buyIn: 2_000_000, entryFee: 200_000 }]);
        expect(registrationBuyIn(found[0], { buyIn: "1", entryFee: "1" })).toBe(2_200_000);
    });

    it("keeps the earliest registration when the player registered twice", () => {
        const found = tournamentRegistrationsFromTxSearch({ tx_responses: [tx(0, "1059400", "100", "0"), tx(0, "1059332")] }, PLAYER);
        expect(earliestRegistrations(found)).toEqual([registration()]);
    });
});

describe("finished busted MTT row", () => {
    const entry = entryFrom();
    const hands = [
        { game_id: `${TID}-t2`, block_height: 1_059_700 },
        { game_id: `${TID}-t1`, block_height: 1_059_805 }
    ];
    const rows = mergeTournamentSessionRows([], [entry], hands, PLAYER);
    const metas = sessionMetasWithTournamentEntries(
        { [entry.gameId]: { format: "tournament", variant: "texas-holdem", minBuyIn: "0", maxBuyIn: "0", handNumber: 63 } },
        [entry]
    );

    it("shows no payout and the finishing place, with buy-in plus entry fee", () => {
        expect(entry.gameId).toBe(`${TID}-t1`);
        expect(entry.tableGameIds).toEqual([`${TID}-t1`]);
        expect(tableGameIdsOf(entry)).toEqual([`${TID}-t1`]);
        expect(rows).toEqual([{ gameId: `${TID}-t1`, joinBlock: REGISTERED_AT, buyIn: 2_200_000, isPrize: false }]);
        expect(sessionGameLabel(metas[entry.gameId], entry.gameId)).toEqual({
            title: "Multi-table tournament · Texas Hold'em",
            detail: "$2.20 buy-in",
            filterKey: "Multi-table tournament · Texas Hold'em"
        });
        expect(sessionBustFor(rows[0], rows, metas[entry.gameId], PLAYER)).toEqual({ placeLabel: "6th" });
        expect(tournamentFinishPlaceLabel(entry.gameId, metas[entry.gameId], PLAYER)).toBe("6th");
        expect(settledSessionCashOut(rows[0], true)).toBe(0);
        expect(variantMoneyFromRows(rows, rows, metas, PLAYER)).toEqual({
            totalBuyIn: 2_200_000,
            totalCashOut: 0,
            netProfit: -2_200_000,
            excludedOpen: 0
        });
    });

    it("uses the last hand on any tournament table as the leave block without closing the bust row", () => {
        expect(withTournamentHandLeaveBlocks({}, [entry], hands)[entry.gameId]).toBe(1_059_805);
        expect(sessionLeaveBlock(rows[0], { placeLabel: "6th" }, 1_059_805)).toBe(1_059_805);
    });
});

describe("paid MTT finish", () => {
    it("writes the payout on the row and keeps the place", () => {
        const entry = entryFrom({
            results: [{ place: 1, playerId: PLAYER, payout: "5600000" }]
        });
        const [row] = mergeTournamentSessionRows([], [entry], [{ game_id: `${TID}-t1`, block_height: 1_060_060 }], PLAYER);
        const metas = sessionMetasWithTournamentEntries({ [entry.gameId]: { format: "tournament", variant: "texas-holdem" } }, [entry]);
        expect(row.cashOut).toBe(5_600_000);
        expect(row.leaveBlock).toBe(1_060_060);
        expect(tournamentFinishPlaceLabel(entry.gameId, metas[entry.gameId], PLAYER)).toBe("1st");
        expect(variantMoneyFromRows([row], [row], metas, PLAYER).netProfit).toBe(5_600_000 - 2_200_000);
    });
});

describe("running MTT row", () => {
    it("counts a running tournament as open", () => {
        const entry = entryFrom({ status: "running", results: [] });
        const hands = [{ game_id: `${TID}-t1`, block_height: 1_059_400 }];
        const rows = mergeTournamentSessionRows([], [entry], hands, PLAYER);
        expect(rows[0].cashOut).toBeUndefined();
        expect(rows[0].leaveBlock).toBe(1_059_400);
        expect(variantMoneyFromRows(rows, rows, sessionMetasWithTournamentEntries({}, [entry]), PLAYER)).toEqual({ excludedOpen: 1 });
    });
});

describe("dedupe", () => {
    const entry = entryFrom();

    it("drops the MTT row when the indexer already has a session for that tournament", () => {
        expect(mergeTournamentSessionRows([indexerRow(`${TID}-t3`)], [entry], [], PLAYER)).toEqual([indexerRow(`${TID}-t3`)]);
        expect(mergeTournamentSessionRows([indexerRow(TID)], [entry], [], PLAYER)).toEqual([indexerRow(TID)]);
    });

    it("keeps an indexer session for a different table", () => {
        const rows = mergeTournamentSessionRows([indexerRow("0xother")], [entry], [], PLAYER);
        expect(rows.map(row => row.gameId)).toEqual([`${TID}-t1`, "0xother"]);
    });
});

describe("tournament record", () => {
    it("parses the chain query and uses the first table", () => {
        const record = readTournamentRecord({
            tournament: JSON.stringify(
                state({
                    tables: [
                        { tableId: `${TID}/t2`, ordinal: 2, players: [], broken: false, handNumber: 1, atBoundary: false },
                        { tableId: `${TID}/t1`, ordinal: 1, players: [], broken: false, handNumber: 4, atBoundary: false }
                    ]
                })
            )
        });
        expect(record?.tournamentId).toBe(TID);
        expect(firstTournamentTableGameId(TID, record?.tables ?? [])).toBe(`${TID}-t1`);
        expect(firstTournamentTableGameId(TID, [])).toBe(`${TID}-t1`);
    });

    it("fills a missing event amount from the tournament options", () => {
        expect(registrationBuyIn({}, state().options)).toBe(2_200_000);
    });
});

describe("tournament unregistrations", () => {
    it("reads a successful refund and ignores a failed tx", () => {
        const found = tournamentUnregistrationsFromTxSearch(
            {
                tx_responses: [
                    {
                        code: 1,
                        height: "1",
                        txhash: "FAIL",
                        events: [{ type: "tournament_unregistered", attributes: [{ key: "player", value: PLAYER }, { key: "tournament_id", value: TID }, { key: "refund", value: "1" }] }]
                    },
                    {
                        code: 0,
                        height: "1091316",
                        txhash: "UNREG",
                        events: [
                            {
                                type: "tournament_unregistered",
                                attributes: [
                                    { key: "tournament_id", value: TID },
                                    { key: "player", value: PLAYER },
                                    { key: "refund", value: "1600000" }
                                ]
                            }
                        ]
                    }
                ]
            },
            PLAYER
        );
        expect(found).toEqual([{ tournamentId: TID, height: 1_091_316, txhash: "UNREG", refund: 1_600_000 }]);

        const unfinished = entryFrom({ status: "registering", results: [] });
        const withRefund = withTournamentRefunds([unfinished], found);
        expect(withRefund[0].refund).toBe(1_600_000);
        expect(tournamentSessionCashOut(withRefund[0], PLAYER)).toBe(1_600_000);

        const finished = entryFrom();
        expect(withTournamentRefunds([finished], found)[0].refund).toBeUndefined();
        expect(tournamentSessionCashOut(finished, PLAYER)).toBeUndefined();
    });
});

describe("tournament table game ids", () => {
    it("lists every table and falls back to t1 when the record has none", () => {
        expect(tournamentTableGameIds(TID, [
            { tableId: `${TID}/t2`, ordinal: 2 },
            { tableId: `${TID}/t1`, ordinal: 1 }
        ])).toEqual([`${TID}-t1`, `${TID}-t2`]);
        expect(firstTournamentTableGameId(TID, [
            { tableId: `${TID}/t2`, ordinal: 2 },
            { tableId: `${TID}/t1`, ordinal: 1 }
        ])).toBe(`${TID}-t1`);
        expect(tournamentTableGameIds(TID, [])).toEqual([`${TID}-t1`]);
        expect(tableGameIdsOf({ gameId: `${TID}-t1` })).toEqual([`${TID}-t1`]);
    });
});

describe("directory-wide tournament events", () => {
    it("groups registrations and unregistrations by player and lists unique tournament ids", () => {
        const other = "b521other";
        const otherTx = {
            code: 0,
            height: "1100000",
            txhash: "OTHER",
            events: [
                {
                    type: "tournament_registered",
                    attributes: [
                        { key: "tournament_id", value: TID },
                        { key: "player", value: other },
                        { key: "buy_in", value: "2000000" },
                        { key: "entry_fee", value: "200000" }
                    ]
                }
            ]
        };
        const grouped = tournamentRegistrationsByPlayer({ tx_responses: [tx(0, "1059332"), otherTx, tx(1, "1059000")] });
        expect(grouped.get(PLAYER)).toEqual([{ tournamentId: TID, height: REGISTERED_AT, buyIn: 2_000_000, entryFee: 200_000 }]);
        expect(grouped.get(other)?.[0].height).toBe(1_100_000);
        expect(uniqueTournamentIds([...(grouped.get(PLAYER) ?? []), ...(grouped.get(other) ?? [])])).toEqual([TID]);

        const unregs = tournamentUnregistrationsByPlayer({
            tx_responses: [
                {
                    code: 0,
                    height: "1091316",
                    txhash: "UNREG",
                    events: [
                        {
                            type: "tournament_unregistered",
                            attributes: [
                                { key: "tournament_id", value: TID },
                                { key: "player", value: PLAYER },
                                { key: "refund", value: "1600000" }
                            ]
                        }
                    ]
                }
            ]
        });
        expect(unregs.get(PLAYER)).toEqual([{ tournamentId: TID, height: 1_091_316, txhash: "UNREG", refund: 1_600_000 }]);
    });

    it("builds entries from records and attaches unregister refunds", () => {
        const registrations = new Map([[PLAYER, [registration()]]]);
        const records = new Map([[TID.toLowerCase(), state()]]);
        const entries = tournamentEntriesByPlayer(registrations, records, new Map());
        expect(entries.get(PLAYER)?.[0]).toMatchObject({ tournamentId: TID, buyIn: 2_200_000, status: "finished" });
        expect(tournamentEntriesByPlayer(registrations, new Map(), new Map()).get(PLAYER)).toEqual([]);
    });
});
