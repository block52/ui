import {
    buildTournamentCard as buildTournamentCardWithFee,
    escrowStatement,
    formatUsdc,
    openingLevelLabel,
    parseTournamentResponse,
    parseTournamentState,
    registrationFeeNotice,
    sortTournamentCards,
    tournamentEntryCost,
    tournamentIdsFromTxSearch,
    tournamentPhase,
    type TournamentRecord
} from "./tournamentLobby";
import { DEFAULT_NETWORK_FEE_MICRO } from "./buyInUtils";

/** Cards priced with the default 0.10 USDC network fee (most tests); fee-specific tests pass their own. */
const buildTournamentCard = (record: TournamentRecord, viewer: string | undefined, nowMs: number) =>
    buildTournamentCardWithFee(record, viewer, nowMs, DEFAULT_NETWORK_FEE_MICRO);

const START = 1_794_481_862_000;
const ME = "b521me";

const stateJson = (over: Record<string, unknown> = {}, optionsOver: Record<string, unknown> = {}) => ({
    tournamentId: "0xabc",
    status: "registering",
    options: {
        buyIn: "1000000",
        protocolFeeBps: 1000,
        startingStack: "1500",
        seatsPerTable: 9,
        minEntrants: 4,
        maxEntrants: 27,
        startTime: START,
        blindStructure: { progression: "double", startSmallBlind: "25", startBigBlind: "50", durationMinutes: 5, roundBlinds: true },
        actionTimeoutSeconds: 25,
        ...optionsOver
    },
    entrants: [
        { address: "b521a", status: "registered", stack: "0" },
        { address: ME, status: "registered", stack: "0" },
        { address: "b521c", status: "unregistered", stack: "0" }
    ],
    prizePool: "0",
    ...over
});

const record = (over: Record<string, unknown> = {}, optionsOver: Record<string, unknown> = {}): TournamentRecord =>
    parseTournamentResponse({ tournament: JSON.stringify(stateJson(over, optionsOver)), creator: "b521creator" });

describe("parseTournamentState", () => {
    it("reads the engine state", () => {
        const s = parseTournamentState(stateJson());
        expect(s.status).toBe("registering");
        expect(s.options.startTime).toBe(START);
        expect(s.entrants).toHaveLength(3);
        expect(s.options.entryFee).toBeUndefined();
    });

    it("keeps the entry fee when present", () => {
        expect(parseTournamentState(stateJson({}, { entryFee: "100000" })).options.entryFee).toBe("100000");
    });

    it("refuses an unknown status instead of defaulting", () => {
        expect(() => parseTournamentState(stateJson({ status: "paused" }))).toThrow("unknown tournament status");
    });

    it("refuses a missing option instead of defaulting", () => {
        const bad = stateJson();
        delete (bad.options as Record<string, unknown>).maxEntrants;
        expect(() => parseTournamentState(bad)).toThrow("maxEntrants");
    });

    it("refuses a money field that is not an integer string", () => {
        expect(() => parseTournamentState(stateJson({}, { buyIn: "1.5" }))).toThrow("buyIn");
    });

    it("refuses an unknown entrant status", () => {
        expect(() => parseTournamentState(stateJson({ entrants: [{ address: "x", status: "lurking" }] }))).toThrow("entrant status");
    });
});

describe("parseTournamentResponse", () => {
    it("unwraps the JSON string and the creator", () => {
        const r = record();
        expect(r.creator).toBe("b521creator");
        expect(r.state.tournamentId).toBe("0xabc");
    });

    it("rejects a payload that is not JSON", () => {
        expect(() => parseTournamentResponse({ tournament: "nope", creator: "x" })).toThrow("not valid JSON");
    });
});

describe("tournamentIdsFromTxSearch", () => {
    const tx = (id: string) => ({ tx_result: { events: [{ type: "message", attributes: [] }, { type: "tournament_created", attributes: [{ key: "tournament_id", value: id }] }] } });

    it("lists ids in order without duplicates", () => {
        expect(tournamentIdsFromTxSearch({ result: { txs: [tx("0x2"), tx("0x1"), tx("0x2")] } })).toEqual(["0x2", "0x1"]);
    });

    it("skips transactions without the event", () => {
        expect(tournamentIdsFromTxSearch({ result: { txs: [{ tx_result: { events: [] } }] } })).toEqual([]);
    });

    it("throws when the response has no txs", () => {
        expect(() => tournamentIdsFromTxSearch({ error: {} })).toThrow("no result.txs");
    });
});

describe("tournamentEntryCost", () => {
    it("adds the flat 0.10 network fee on top of the buy-in when there is no percentage rate (pokerchain#476)", () => {
        const c = tournamentEntryCost({ buyIn: "5000000", entryFee: "500000" }, DEFAULT_NETWORK_FEE_MICRO);
        expect(c).toEqual({ gross: 5_000_000n, entryFee: 500_000n, protocolCut: 0n, networkFee: 100_000n, total: 5_100_000n, net: 4_500_000n });
    });

    it("charges the same network fee at every buy-in", () => {
        expect(tournamentEntryCost({ buyIn: "1000000" }, DEFAULT_NETWORK_FEE_MICRO).networkFee).toBe(100_000n);
        expect(tournamentEntryCost({ buyIn: "1000000000" }, DEFAULT_NETWORK_FEE_MICRO).networkFee).toBe(100_000n);
        expect(tournamentEntryCost({ buyIn: "1000000", protocolFeeBps: 0 }, DEFAULT_NETWORK_FEE_MICRO).networkFee).toBe(100_000n);
    });

    it("keeps the legacy percentage for older tournaments: entry fee and cut out of the buy-in, no flat fee", () => {
        const c = tournamentEntryCost({ buyIn: "5000000", entryFee: "500000", protocolFeeBps: 1000 }, DEFAULT_NETWORK_FEE_MICRO);
        expect(c).toEqual({ gross: 5_000_000n, entryFee: 500_000n, protocolCut: 500_000n, networkFee: 0n, total: 5_000_000n, net: 4_000_000n });
    });

    it("floors the protocol cut like the chain", () => {
        expect(tournamentEntryCost({ buyIn: "333", protocolFeeBps: 1000 }, DEFAULT_NETWORK_FEE_MICRO).protocolCut).toBe(33n);
    });

    it("charges the governance-set network fee on top (pokerchain#476)", () => {
        const c = tournamentEntryCost({ buyIn: "5000000", entryFee: "500000" }, 250_000n);
        expect(c).toEqual({ gross: 5_000_000n, entryFee: 500_000n, protocolCut: 0n, networkFee: 250_000n, total: 5_250_000n, net: 4_500_000n });
    });

    it("charges nothing on top when governance sets the fee to 0", () => {
        const c = tournamentEntryCost({ buyIn: "5000000", entryFee: "500000" }, 0n);
        expect(c).toEqual({ gross: 5_000_000n, entryFee: 500_000n, protocolCut: 0n, networkFee: 0n, total: 5_000_000n, net: 4_500_000n });
    });

    it("with no entry fee the whole buy-in is escrowed", () => {
        expect(tournamentEntryCost({ buyIn: "1000000" }, DEFAULT_NETWORK_FEE_MICRO).net).toBe(1_000_000n);
    });
});

describe("tournamentPhase", () => {
    it("is open before the start and full at the maximum", () => {
        expect(tournamentPhase(record().state, START - 1000)).toBe("open");
        expect(tournamentPhase(record({}, { maxEntrants: 2 }).state, START - 1000)).toBe("full");
    });

    it("is starting once the time has passed but the chain has not run the start", () => {
        expect(tournamentPhase(record().state, START)).toBe("starting");
    });

    it("follows the stored status after that", () => {
        expect(tournamentPhase(record({ status: "running" }).state, START + 1)).toBe("running");
        expect(tournamentPhase(record({ status: "finished" }).state, START + 1)).toBe("finished");
        expect(tournamentPhase(record({ status: "cancelled" }).state, START + 1)).toBe("cancelled");
    });
});

describe("buildTournamentCard", () => {
    it("counts registered entrants and projects the prize pool while registering", () => {
        const card = buildTournamentCard(record(), "b521other", START - 60_000);
        expect(card.registered).toBe(2);
        expect(card.maxEntrants).toBe(27);
        // 1.00 USDC buy-in, 10% protocol -> 0.90 net x 2 registered
        expect(card.prizePoolMicro).toBe(1_800_000n);
        expect(card.prizePoolIsProjected).toBe(true);
        expect(card.msUntilStart).toBe(60_000);
        expect(card.blindLabel).toBe("25/50 blinds, 5 min levels");
    });

    it("flags a tournament under its minimum", () => {
        expect(buildTournamentCard(record(), "b521other", START - 1000).atRiskOfCancelling).toBe(true);
        expect(buildTournamentCard(record({}, { minEntrants: 2 }), "b521other", START - 1000).atRiskOfCancelling).toBe(false);
    });

    it("lets a stranger register and a registered viewer unregister", () => {
        const stranger = buildTournamentCard(record(), "b521other", START - 1000);
        expect(stranger.canRegister).toBe(true);
        expect(stranger.canUnregister).toBe(false);
        const me = buildTournamentCard(record(), ME, START - 1000);
        expect(me.isRegistered).toBe(true);
        expect(me.canRegister).toBe(false);
        expect(me.canUnregister).toBe(true);
    });

    it("lets an unregistered entrant register again", () => {
        const card = buildTournamentCard(record(), "b521c", START - 1000);
        expect(card.isRegistered).toBe(false);
        expect(card.canRegister).toBe(true);
    });

    it("blocks registering without a wallet, when full, and after the start time", () => {
        expect(buildTournamentCard(record(), undefined, START - 1000).registerBlockedReason).toBe("Connect a wallet to register");
        expect(buildTournamentCard(record({}, { maxEntrants: 2 }), "b521other", START - 1000).registerBlockedReason).toBe("The tournament is full");
        const late = buildTournamentCard(record(), "b521other", START + 5);
        expect(late.canRegister).toBe(false);
        expect(late.registerBlockedReason).toBe("Registration is closed");
    });

    it("reports the fixed prize pool once running", () => {
        const card = buildTournamentCard(record({ status: "running", prizePool: "24300000" }), "b521other", START + 1000);
        expect(card.prizePoolMicro).toBe(24_300_000n);
        expect(card.prizePoolIsProjected).toBe(false);
        expect(card.canUnregister).toBe(false);
    });
});

describe("buildTournamentCard: where the viewer plays", () => {
    const running = (entrants: unknown[]) => record({ status: "running", entrants });

    it("names the table the viewer is playing at, by game id and number", () => {
        const card = buildTournamentCard(running([{ address: ME, status: "playing", tableId: "0xabc/t3", stack: "1500" }]), ME, START + 1000);
        expect(card.myTable).toEqual({ gameId: "0xabc-t3", number: 3 });
        expect(card.canUnregister).toBe(false);
    });

    it("has no table once the tournament is over, even though the winner's status is still playing", () => {
        const winner = [{ address: ME, status: "playing", tableId: "0xabc/t1", stack: "40500" }];
        expect(buildTournamentCard(record({ status: "finished", entrants: winner }), ME, START + 1000).myTable).toBeUndefined();
        expect(buildTournamentCard(record({ status: "cancelled", entrants: winner }), ME, START + 1000).myTable).toBeUndefined();
        expect(buildTournamentCard(record({ status: "running", entrants: winner }), ME, START + 1000).myTable).toEqual({ gameId: "0xabc-t1", number: 1 });
    });

    it("has no table for a viewer who busted, never played, or has no wallet", () => {
        const entrants = [
            { address: ME, status: "busted", stack: "0" },
            { address: "b521other", status: "playing", tableId: "0xabc/t1", stack: "1500" }
        ];
        expect(buildTournamentCard(running(entrants), ME, START + 1000).myTable).toBeUndefined();
        expect(buildTournamentCard(running(entrants), "b521nobody", START + 1000).myTable).toBeUndefined();
        expect(buildTournamentCard(running(entrants), undefined, START + 1000).myTable).toBeUndefined();
    });
});

describe("sortTournamentCards", () => {
    it("puts the tournament the viewer is playing in first", () => {
        const mine = buildTournamentCard(record({ tournamentId: "mine", status: "running", entrants: [{ address: ME, status: "playing", tableId: "0xabc/t1", stack: "1" }] }), ME, START + 1000);
        const open = buildTournamentCard(record({ tournamentId: "open", status: "registering" }), ME, START - 100_000);
        expect(sortTournamentCards([open, mine]).map(c => c.tournamentId)).toEqual(["mine", "open"]);
    });

    it("puts open registrations first by start time, then running, then finished", () => {
        const mk = (id: string, status: string, startTime: number) => buildTournamentCard(record({ tournamentId: id, status }, { startTime }), undefined, START - 100_000);
        const sorted = sortTournamentCards([mk("fin", "finished", START), mk("late", "registering", START + 5_000), mk("run", "running", START), mk("soon", "registering", START)]);
        expect(sorted.map(c => c.tournamentId)).toEqual(["soon", "late", "run", "fin"]);
    });
});

describe("escrowStatement", () => {
    const cost = tournamentEntryCost({ buyIn: "5000000", entryFee: "500000", protocolFeeBps: 1000 }, DEFAULT_NETWORK_FEE_MICRO);

    it("states the buy-in plus network fee, the escrow, and that the network fee is not refunded (pokerchain#476)", () => {
        const s = escrowStatement(tournamentEntryCost({ buyIn: "5000000", entryFee: "500000" }, DEFAULT_NETWORK_FEE_MICRO));
        expect(s.register).toContain("You pay $5.10");
        expect(s.register).toContain("$0.10 network fee");
        expect(s.register).toContain("$4.50 of it is held in escrow");
        expect(s.register).toContain("not refunded");
        expect(s.unregister).toContain("not the full $5.10");
        expect(s.unregister).toContain("$0.10 network fee");
    });

    it("states the escrow and that the fees are not refunded", () => {
        const s = escrowStatement(cost);
        expect(s.register).toContain("$5.00");
        expect(s.register).toContain("$4.00");
        expect(s.register).toContain("not refunded");
    });

    it("does not promise a full refund when unregistering or when cancelled", () => {
        const s = escrowStatement(cost);
        expect(s.unregister).toContain("not the full $5.00");
        expect(s.unregister).toContain("cancelled");
        expect(s.unregister).not.toMatch(/full refund/i);
    });

    it("says the network fee alone is not refunded when there is no entry fee", () => {
        expect(escrowStatement(tournamentEntryCost({ buyIn: "1000000" }, DEFAULT_NETWORK_FEE_MICRO)).register).toContain("The $0.10 network fee is taken at registration and is not refunded.");
    });

    it("does not mention a network fee when governance sets it to 0", () => {
        const s = escrowStatement(tournamentEntryCost({ buyIn: "1000000" }, 0n));
        expect(s.register).toBe("You pay $1.00 now. $1.00 of it is held in escrow for the prize pool.");
        expect(s.register).not.toContain("network fee");
    });

    it("omits the fee note when an older tournament has no fees", () => {
        expect(escrowStatement(tournamentEntryCost({ buyIn: "5", protocolFeeBps: 1000 }, DEFAULT_NETWORK_FEE_MICRO)).register).not.toContain("not refunded");
    });
});

describe("buildTournamentCard network fee", () => {
    it("prices the card with the network fee it is given", () => {
        const newTournament = record({}, { protocolFeeBps: undefined });
        expect(buildTournamentCardWithFee(newTournament, undefined, START - 1000, 250_000n).cost.networkFee).toBe(250_000n);
        expect(buildTournamentCardWithFee(newTournament, undefined, START - 1000, 250_000n).cost.total).toBe(1_250_000n);
        expect(buildTournamentCardWithFee(newTournament, undefined, START - 1000, 0n).cost.total).toBe(1_000_000n);
    });
});

describe("registrationFeeNotice", () => {
    it("names the chain's network fee", () => {
        expect(registrationFeeNotice(100_000n)).toContain("plus a $0.10 network fee");
        expect(registrationFeeNotice(250_000n)).toContain("plus a $0.25 network fee");
        expect(registrationFeeNotice(250_000n)).toContain("The network fee and the entry fee");
    });

    it("mentions no network fee when it is 0", () => {
        expect(registrationFeeNotice(0n)).not.toContain("network fee");
        expect(registrationFeeNotice(0n)).toContain("You pay the buy-in when you register.");
    });
});

describe("formatUsdc", () => {
    it("shows cents and keeps non-zero digits beyond", () => {
        expect(formatUsdc(1_250_000n)).toBe("$1.25");
        expect(formatUsdc(333_333n)).toBe("$0.333333");
        expect(formatUsdc(0n)).toBe("$0.00");
        expect(formatUsdc(1_234_567_000_000n)).toBe("$1,234,567.00");
    });
});

describe("openingLevelLabel", () => {
    it("describes the opening level", () => {
        expect(openingLevelLabel({ preset: "turbo" })).toMatch(/blinds, \d+ min levels/);
    });
});
