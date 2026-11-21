import type { BlindStructureDTO, PayoutPlaceDTO, ResultDTO, TournamentEntrantStatus, TournamentStatus } from "@block52/poker-vm-sdk";

/**
 * The chain's tournament record (GET /block52/pokerchain/poker/v1/tournament/{id},
 * the `tournament` JSON string). Mirrors pvm/go/engine/tournament.go
 * TournamentStateDTO.
 *
 * TODO(sdk): @block52/poker-vm-sdk 1.24.0 exports TournamentStatus,
 * TournamentEntrantStatus, LeaderboardDTO and the blind types, but NOT this
 * record (nor `tournamentId` on TexasHoldemStateDTO). Replace this file with the
 * SDK type once it is published (Commandment 1).
 */
export type TournamentOptionsDTO = {
    buyIn: string;
    entryFee?: string;
    protocolFeeBps?: number;
    startingStack: string;
    seatsPerTable: number;
    minEntrants: number;
    maxEntrants: number;
    startTime: number;
    blindStructure: BlindStructureDTO;
    actionTimeoutSeconds: number;
    /** Optional custom name if the engine ever stores one. */
    name?: string;
};

export type TournamentEntrantDTO = {
    address: string;
    status: TournamentEntrantStatus;
    /** Engine table id, e.g. `<tournamentId>/t1` (not the game id). Set while playing. */
    tableId?: string;
    seat?: number;
    stack: string;
};

export type TournamentTableDTO = {
    tableId: string;
    ordinal: number;
    players: string[];
    broken: boolean;
    handNumber: number;
    atBoundary: boolean;
    /** Director hold: "break" (level break) or "final-table". Empty when free. */
    hold?: string;
};

/**
 * A reserved seat move that has not executed yet (pvm/go/engine MoveIntentDTO).
 * `reason` is "balance" (fill a short table) or "break" (this table is being
 * broken and its players are being sent to others).
 */
export type MoveIntentDTO = {
    key: string;
    address: string;
    from: string;
    to: string;
    seat: number;
    reason: string;
};

export type TournamentStateDTO = {
    tournamentId: string;
    status: TournamentStatus;
    /** Optional custom name; same caveat as options.name. */
    name?: string;
    options: TournamentOptionsDTO;
    entrants: TournamentEntrantDTO[];
    tables: TournamentTableDTO[];
    startedAt?: number;
    level: number;
    levelStartTime?: number;
    prizePool: string;
    payouts: PayoutPlaceDTO[];
    results: ResultDTO[];
    /** Reserved moves waiting for both tables to reach a hand boundary. */
    intents?: MoveIntentDTO[];
    seq: number;
};

/** Response of the tournament query: the state is a JSON string. */
export type TournamentResponse = { tournament: string };
