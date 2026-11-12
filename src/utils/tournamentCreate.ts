/**
 * The create-tournament form's validation (ui#980 slice 3).
 *
 * Mirrors the rules the chain and the Go engine apply to MsgCreateTournament so a
 * mistake is caught before a fee-charging transaction is signed:
 *
 *   - poker-vm pvm/go/engine/tournament.go `validateTournamentOptions`
 *     (buy-in > 0, entry fee < buy-in, positive stack, seats 2..9, min >= 2,
 *     max within min..180, start time set, action timeout > 0, blind structure);
 *   - pokerchain x/poker/keeper/msg_server_tournament.go `CreateTournament`
 *     (start time in the future, blind structure required, net buy-in positive
 *     after the entry fee and protocol cut).
 *
 * The engine stays the authority: it re-validates on chain and its error is shown
 * verbatim if it disagrees. Errors here are keyed by form field so the form can
 * print each one under its input. Nothing is defaulted: an empty field is an error.
 */
import { type BlindStructureDTO } from "@block52/poker-vm-sdk";
import { parseUsdcToMicro } from "../constants/currency";
import { CREATION_FEE_BIG_BLINDS } from "./tableCreationFee";
import { isBlank, isNullish } from "./guards";
import { localDateTimeToUnixSeconds } from "./scheduledSng";
import type { CreateTournamentParams } from "./tournamentTx";

/** pvm/go/engine/tournament.go TournamentMinSeatsPerTable / MaxSeatsPerTable / MaxEntrantsCap. */
export const TOURNAMENT_MIN_SEATS = 2;
export const TOURNAMENT_MAX_SEATS = 9;
export const TOURNAMENT_MAX_ENTRANTS_CAP = 180;
export const TOURNAMENT_MIN_ENTRANTS = 2;

/** The start must lie this far ahead so a slow block does not land it in the past (the chain only needs "future"). */
export const TOURNAMENT_MIN_LEAD_SECONDS = 60;

export interface TournamentFormValues {
    /** USDC decimal text, e.g. "5" or "2.50". */
    buyIn: string;
    /** USDC decimal text; "0" for none. */
    entryFee: string;
    startingStack: string;
    seatsPerTable: string;
    minEntrants: string;
    maxEntrants: string;
    /** `datetime-local` value. */
    startTime: string;
    actionTimeoutSeconds: string;
}

export type TournamentFormField = keyof TournamentFormValues | "blindStructure";

export type TournamentFormErrors = Partial<Record<TournamentFormField, string>>;

export interface TournamentFormInput {
    values: TournamentFormValues;
    /** The structure the blind picker resolved to; undefined when it has not (see blindError). */
    blindStructure: BlindStructureDTO | undefined;
    /** The blind picker's own error (custom text that does not parse). */
    blindError?: string;
    /** The chain's protocol cut in basis points, when known, for the net buy-in check. */
    protocolFeeBps?: number;
    nowMs: number;
}

export interface TournamentFormResult {
    errors: TournamentFormErrors;
    /** Present only when there are no errors. */
    params?: CreateTournamentParams;
}

/** Defaults the form opens with. The start time is filled by {@link defaultStartTimeLocal}. */
export const DEFAULT_TOURNAMENT_FORM_VALUES: Omit<TournamentFormValues, "startTime"> = {
    buyIn: "5",
    entryFee: "0",
    startingStack: "1500",
    seatsPerTable: "9",
    minEntrants: "2",
    maxEntrants: "27",
    actionTimeoutSeconds: "25"
};

/** A `datetime-local` value one hour from `nowMs`, on the hour boundary, in the viewer's time zone. */
export function defaultStartTimeLocal(nowMs: number): string {
    const d = new Date(Math.ceil((nowMs + 60 * 60 * 1000) / 3_600_000) * 3_600_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The structure a tournament submits: the chain requires one, so the doubling choice (which a sit-and-go leaves to the engine) submits its preview. */
export function tournamentBlindStructure(plan: { structure?: BlindStructureDTO; preview?: BlindStructureDTO }): BlindStructureDTO | undefined {
    return plan.structure ?? plan.preview;
}

const WHOLE = /^[0-9]+$/;

function parseWhole(text: string, name: string, errors: TournamentFormErrors, field: TournamentFormField): number | undefined {
    const t = text.trim();
    if (!WHOLE.test(t)) {
        errors[field] = `${name} must be a whole number`;
        return undefined;
    }
    const n = Number(t);
    if (!Number.isSafeInteger(n)) {
        errors[field] = `${name} is too large`;
        return undefined;
    }
    return n;
}

function parseMoney(text: string, name: string, errors: TournamentFormErrors, field: TournamentFormField): bigint | undefined {
    if (isBlank(text)) {
        errors[field] = `${name} is required`;
        return undefined;
    }
    try {
        return parseUsdcToMicro(text);
    } catch {
        errors[field] = `${name} must be a USDC amount with up to 6 decimals`;
        return undefined;
    }
}

export function validateTournamentForm(input: TournamentFormInput): TournamentFormResult {
    const { values, blindStructure, blindError, protocolFeeBps, nowMs } = input;
    const errors: TournamentFormErrors = {};

    const buyIn = parseMoney(values.buyIn, "Buy-in", errors, "buyIn");
    if (!isNullish(buyIn) && buyIn <= 0n) errors.buyIn = "Buy-in must be more than 0";

    const entryFee = parseMoney(values.entryFee, "Entry fee", errors, "entryFee");
    if (!isNullish(buyIn) && !isNullish(entryFee) && isNullish(errors.entryFee) && entryFee >= buyIn) {
        errors.entryFee = "Entry fee must be less than the buy-in (it comes out of the buy-in)";
    }

    if (!isNullish(buyIn) && !isNullish(entryFee) && isNullish(errors.buyIn) && isNullish(errors.entryFee) && !isNullish(protocolFeeBps) && protocolFeeBps > 0) {
        const cut = (buyIn * BigInt(protocolFeeBps)) / 10000n;
        if (entryFee + cut >= buyIn) errors.entryFee = "Entry fee plus the protocol fee must leave part of the buy-in for the prize pool";
    }

    const startingStack = parseWhole(values.startingStack, "Starting stack", errors, "startingStack");
    if (!isNullish(startingStack) && startingStack <= 0) errors.startingStack = "Starting stack must be more than 0";

    const seats = parseWhole(values.seatsPerTable, "Seats per table", errors, "seatsPerTable");
    if (!isNullish(seats) && (seats < TOURNAMENT_MIN_SEATS || seats > TOURNAMENT_MAX_SEATS)) {
        errors.seatsPerTable = `Seats per table must be ${TOURNAMENT_MIN_SEATS} to ${TOURNAMENT_MAX_SEATS}`;
    }

    const min = parseWhole(values.minEntrants, "Minimum entrants", errors, "minEntrants");
    if (!isNullish(min) && min < TOURNAMENT_MIN_ENTRANTS) errors.minEntrants = `Minimum entrants must be at least ${TOURNAMENT_MIN_ENTRANTS}`;

    const max = parseWhole(values.maxEntrants, "Maximum entrants", errors, "maxEntrants");
    if (!isNullish(max) && !isNullish(min) && isNullish(errors.minEntrants) && (max < min || max > TOURNAMENT_MAX_ENTRANTS_CAP)) {
        errors.maxEntrants = `Maximum entrants must be ${min} to ${TOURNAMENT_MAX_ENTRANTS_CAP}`;
    } else if (!isNullish(max) && max > TOURNAMENT_MAX_ENTRANTS_CAP) {
        errors.maxEntrants = `Maximum entrants cannot be more than ${TOURNAMENT_MAX_ENTRANTS_CAP}`;
    }

    let startSeconds: number | undefined;
    if (isBlank(values.startTime)) {
        errors.startTime = "Start time is required";
    } else {
        const s = localDateTimeToUnixSeconds(values.startTime);
        if (!Number.isFinite(s)) {
            errors.startTime = "Start time is not a valid date";
        } else if (s * 1000 < nowMs + TOURNAMENT_MIN_LEAD_SECONDS * 1000) {
            errors.startTime = `Start time must be at least ${TOURNAMENT_MIN_LEAD_SECONDS} seconds in the future`;
        } else {
            startSeconds = s;
        }
    }

    const timeout = parseWhole(values.actionTimeoutSeconds, "Action timeout", errors, "actionTimeoutSeconds");
    if (!isNullish(timeout) && timeout <= 0) errors.actionTimeoutSeconds = "Action timeout must be more than 0 seconds";

    if (!isNullish(blindError)) errors.blindStructure = blindError;
    else if (isNullish(blindStructure)) errors.blindStructure = "Choose a blind structure";

    if (
        Object.keys(errors).length > 0 ||
        isNullish(buyIn) ||
        isNullish(entryFee) ||
        isNullish(startingStack) ||
        isNullish(seats) ||
        isNullish(min) ||
        isNullish(max) ||
        isNullish(startSeconds) ||
        isNullish(timeout) ||
        isNullish(blindStructure)
    ) {
        return { errors };
    }

    return {
        errors,
        params: {
            buyIn,
            entryFee,
            startingStack: BigInt(startingStack),
            seatsPerTable: seats,
            minEntrants: min,
            maxEntrants: max,
            startTime: startSeconds,
            blindStructure,
            actionTimeoutSeconds: timeout
        }
    };
}

/**
 * The micro-USDC the chain debits from the creator: the value of 10 big blinds of
 * level 1 at the buy-in's chip price, floor(10 x bigBlind x buyIn / startingStack)
 * (pokerchain `GameCreationFee`, same as a sit-and-go). null when the chain could
 * not price it (zero big blind or stack).
 */
export function tournamentCreationFeeMicro(buyInMicro: bigint, startingStack: bigint, firstBigBlind: bigint): bigint | null {
    if (startingStack <= 0n || firstBigBlind <= 0n) return null;
    return (CREATION_FEE_BIG_BLINDS * firstBigBlind * buyInMicro) / startingStack;
}
