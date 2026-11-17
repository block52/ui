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
    hold?: string;
};

export type TournamentStateDTO = {
    tournamentId: string;
    status: TournamentStatus;
    options: TournamentOptionsDTO;
    entrants: TournamentEntrantDTO[];
    tables: TournamentTableDTO[];
    startedAt?: number;
    level: number;
    levelStartTime?: number;
    prizePool: string;
    payouts: PayoutPlaceDTO[];
    results: ResultDTO[];
    seq: number;
};

/** Response of the tournament query: the state is a JSON string. */
export type TournamentResponse = { tournament: string };
