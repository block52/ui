import {
    buildTournamentCard,
    escrowStatement,
    formatUsdc,
    openingLevelLabel,
    parseTournamentResponse,
    parseTournamentState,
    sortTournamentCards,
    tournamentEntryCost,
    tournamentIdsFromTxSearch,
    tournamentPhase,
    type TournamentRecord
} from "./tournamentLobby";

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
    it("takes the entry fee and protocol cut out of the buy-in", () => {
        const c = tournamentEntryCost({ buyIn: "5000000", entryFee: "500000", protocolFeeBps: 1000 });
        expect(c).toEqual({ gross: 5_000_000n, entryFee: 500_000n, protocolCut: 500_000n, net: 4_000_000n });
    });

    it("floors the protocol cut like the chain", () => {
        expect(tournamentEntryCost({ buyIn: "333", protocolFeeBps: 1000 }).protocolCut).toBe(33n);
    });

    it("with no fees the whole buy-in is escrowed", () => {
        expect(tournamentEntryCost({ buyIn: "1000000" }).net).toBe(1_000_000n);
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

describe("sortTournamentCards", () => {
    it("puts open registrations first by start time, then running, then finished", () => {
        const mk = (id: string, status: string, startTime: number) => buildTournamentCard(record({ tournamentId: id, status }, { startTime }), undefined, START - 100_000);
        const sorted = sortTournamentCards([mk("fin", "finished", START), mk("late", "registering", START + 5_000), mk("run", "running", START), mk("soon", "registering", START)]);
        expect(sorted.map(c => c.tournamentId)).toEqual(["soon", "late", "run", "fin"]);
    });
});

describe("escrowStatement", () => {
    const cost = tournamentEntryCost({ buyIn: "5000000", entryFee: "500000", protocolFeeBps: 1000 });

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

    it("omits the fee note when there are no fees", () => {
        expect(escrowStatement(tournamentEntryCost({ buyIn: "1000000" })).register).not.toContain("not refunded");
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
