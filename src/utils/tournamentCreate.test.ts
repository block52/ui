import type { BlindStructureDTO } from "@block52/poker-vm-sdk";
import {
    DEFAULT_TOURNAMENT_FORM_VALUES,
    defaultStartTimeLocal,
    tournamentBlindStructure,
    tournamentCreationFeeMicro,
    validateTournamentForm,
    type TournamentFormValues
} from "./tournamentCreate";
import { isSdkGapError, getTournamentTxClient } from "./tournamentTx";

const NOW = new Date(2026, 10, 12, 10, 0, 0).getTime();
const STRUCTURE: BlindStructureDTO = { preset: "turbo" };

const localInput = (ms: number): string => {
    const d = new Date(ms);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const values = (over: Partial<TournamentFormValues> = {}): TournamentFormValues => ({
    ...DEFAULT_TOURNAMENT_FORM_VALUES,
    startTime: localInput(NOW + 2 * 3_600_000),
    ...over
});

const validate = (over: Partial<TournamentFormValues> = {}, extra: { blindStructure?: BlindStructureDTO | undefined; blindError?: string; protocolFeeBps?: number } = {}) =>
    validateTournamentForm({ values: values(over), blindStructure: "blindStructure" in extra ? extra.blindStructure : STRUCTURE, blindError: extra.blindError, protocolFeeBps: extra.protocolFeeBps, nowMs: NOW });

describe("validateTournamentForm", () => {
    it("accepts the defaults and builds the message in chain units", () => {
        const { errors, params } = validate();
        expect(errors).toEqual({});
        expect(params).toEqual({
            buyIn: 5_000_000n,
            entryFee: 0n,
            startingStack: 1500n,
            seatsPerTable: 9,
            minEntrants: 2,
            maxEntrants: 27,
            startTime: Math.floor(new Date(values().startTime).getTime() / 1000),
            blindStructure: STRUCTURE,
            actionTimeoutSeconds: 25
        });
    });

    it("parses USDC exactly", () => {
        expect(validate({ buyIn: "2.01" }).params?.buyIn).toBe(2_010_000n);
    });

    it("rejects an empty or malformed buy-in and a zero buy-in", () => {
        expect(validate({ buyIn: "" }).errors.buyIn).toMatch(/required/);
        expect(validate({ buyIn: "abc" }).errors.buyIn).toMatch(/USDC amount/);
        expect(validate({ buyIn: "0" }).errors.buyIn).toMatch(/more than 0/);
        expect(validate({ buyIn: "1.1234567" }).errors.buyIn).toMatch(/6 decimals/);
    });

    it("requires the entry fee below the buy-in (engine: entryFee must be less than buyIn)", () => {
        expect(validate({ buyIn: "5", entryFee: "5" }).errors.entryFee).toMatch(/less than the buy-in/);
        expect(validate({ buyIn: "5", entryFee: "4.99" }).errors.entryFee).toBeUndefined();
    });

    it("requires a positive net buy-in after the protocol cut when the rate is known", () => {
        expect(validate({ buyIn: "10", entryFee: "9.5" }, { protocolFeeBps: 1000 }).errors.entryFee).toMatch(/protocol fee/);
        expect(validate({ buyIn: "10", entryFee: "5" }, { protocolFeeBps: 1000 }).errors.entryFee).toBeUndefined();
    });

    it("requires a positive whole starting stack", () => {
        expect(validate({ startingStack: "0" }).errors.startingStack).toMatch(/more than 0/);
        expect(validate({ startingStack: "15.5" }).errors.startingStack).toMatch(/whole number/);
    });

    it("keeps seats per table within 2..9", () => {
        expect(validate({ seatsPerTable: "1" }).errors.seatsPerTable).toBeDefined();
        expect(validate({ seatsPerTable: "10" }).errors.seatsPerTable).toBeDefined();
        expect(validate({ seatsPerTable: "2" }).errors.seatsPerTable).toBeUndefined();
        expect(validate({ seatsPerTable: "9" }).errors.seatsPerTable).toBeUndefined();
    });

    it("requires min entrants of at least 2", () => {
        expect(validate({ minEntrants: "1" }).errors.minEntrants).toMatch(/at least 2/);
    });

    it("requires max entrants within min..180", () => {
        expect(validate({ minEntrants: "10", maxEntrants: "9" }).errors.maxEntrants).toMatch(/10 to 180/);
        expect(validate({ minEntrants: "10", maxEntrants: "181" }).errors.maxEntrants).toBeDefined();
        expect(validate({ minEntrants: "10", maxEntrants: "180" }).errors.maxEntrants).toBeUndefined();
        expect(validate({ minEntrants: "10", maxEntrants: "10" }).errors.maxEntrants).toBeUndefined();
    });

    it("requires a start time in the future with a minute of lead", () => {
        expect(validate({ startTime: "" }).errors.startTime).toMatch(/required/);
        expect(validate({ startTime: "not a date" }).errors.startTime).toMatch(/valid date/);
        expect(validate({ startTime: localInput(NOW - 3_600_000) }).errors.startTime).toMatch(/future/);
        expect(validate({ startTime: localInput(NOW + 30_000) }).errors.startTime).toMatch(/future/);
    });

    it("requires a positive action timeout", () => {
        expect(validate({ actionTimeoutSeconds: "0" }).errors.actionTimeoutSeconds).toMatch(/more than 0/);
        expect(validate({ actionTimeoutSeconds: "" }).errors.actionTimeoutSeconds).toBeDefined();
    });

    it("requires a resolved blind structure and passes the picker's error through", () => {
        expect(validate({}, { blindStructure: undefined }).errors.blindStructure).toBe("Choose a blind structure");
        expect(validate({}, { blindStructure: undefined, blindError: "levels: bad" }).errors.blindStructure).toBe("levels: bad");
    });

    it("returns no params while any error stands", () => {
        expect(validate({ buyIn: "" }).params).toBeUndefined();
    });
});

describe("defaultStartTimeLocal", () => {
    it("is on an hour boundary at least an hour away", () => {
        const s = defaultStartTimeLocal(NOW);
        expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00$/);
        expect(new Date(s).getTime()).toBeGreaterThanOrEqual(NOW + 3_600_000);
    });
});

describe("tournamentBlindStructure", () => {
    it("prefers the submitted structure and falls back to the preview (the chain requires one)", () => {
        const preview: BlindStructureDTO = { progression: "double", startSmallBlind: "25", startBigBlind: "50", durationMinutes: 5, roundBlinds: true };
        expect(tournamentBlindStructure({ structure: STRUCTURE, preview })).toBe(STRUCTURE);
        expect(tournamentBlindStructure({ preview })).toBe(preview);
        expect(tournamentBlindStructure({})).toBeUndefined();
    });
});

describe("tournamentCreationFeeMicro", () => {
    it("matches the chain: 10 big blinds at the buy-in's chip price", () => {
        // 1 USDC buy-in, 1500 chips, big blind 50 -> floor(10 x 50 x 1_000_000 / 1500) = 333333 (the fee seen on the local chain)
        expect(tournamentCreationFeeMicro(1_000_000n, 1500n, 50n)).toBe(333_333n);
    });

    it("cannot price a zero stack or blind", () => {
        expect(tournamentCreationFeeMicro(1_000_000n, 0n, 50n)).toBeNull();
        expect(tournamentCreationFeeMicro(1_000_000n, 1500n, 0n)).toBeNull();
    });
});

describe("tournament transactions (SDK gap)", () => {
    it("refuses every call with an error that names what is missing", async () => {
        const client = getTournamentTxClient();
        const calls = [
            client.registerTournament("0x1"),
            client.unregisterTournament("0x1"),
            client.createTournament({
                buyIn: 1n,
                entryFee: 0n,
                startingStack: 1500n,
                seatsPerTable: 9,
                minEntrants: 2,
                maxEntrants: 9,
                startTime: 1,
                blindStructure: STRUCTURE,
                actionTimeoutSeconds: 25
            })
        ];
        for (const call of calls) {
            const err = await call.catch((e: unknown) => e);
            expect(isSdkGapError(err)).toBe(true);
            expect(err).toHaveProperty("message", expect.stringContaining("SDK release"));
        }
    });
});
