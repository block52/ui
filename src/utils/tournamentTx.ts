/**
 * The transaction side of multi-table tournaments (ui#980 slices 2-3).
 *
 * SDK GAP (block52/poker-vm sdk 1.24.0): the chain has MsgCreateTournament,
 * MsgRegisterTournament and MsgUnregisterTournament (pokerchain tx.proto), but the
 * published SDK neither generates those messages nor exposes `createTournament`,
 * `registerTournament` or `unregisterTournament` on SigningCosmosClient. The UI must
 * not hand-roll proto, so the three calls sit behind {@link TournamentTxClient}, and
 * {@link getTournamentTxClient} returns the one implementation that exists today:
 * one that refuses with {@link SdkGapError}. When the SDK ships the helpers, replace
 * that body with calls to `(await getSigningClient(network)).signingClient` and
 * delete the error class. Nothing else in the UI changes.
 *
 * The method shapes below are the proposal for the SDK: they mirror the messages
 * field for field (money in micro-USDC, chips as chips, start time in unix seconds).
 */
import type { BlindStructureDTO } from "@block52/poker-vm-sdk";

export interface CreateTournamentParams {
    /** Gross buy-in per entrant, micro-USDC. */
    buyIn: bigint;
    /** Flat entry fee inside the buy-in, to the creator, micro-USDC. 0 = none. */
    entryFee: bigint;
    startingStack: bigint;
    /** 2..9 */
    seatsPerTable: number;
    /** >= 2; the tournament cancels at the start time with fewer. */
    minEntrants: number;
    /** min..180 */
    maxEntrants: number;
    /** Scheduled start, unix SECONDS, in the future. */
    startTime: number;
    blindStructure: BlindStructureDTO;
    actionTimeoutSeconds: number;
}

export interface TournamentTxClient {
    /** Resolves once the tx is committed and executed; `tournamentId` is the id the chain derived. */
    createTournament(params: CreateTournamentParams): Promise<{ txHash: string; tournamentId: string }>;
    registerTournament(tournamentId: string): Promise<{ txHash: string }>;
    unregisterTournament(tournamentId: string): Promise<{ txHash: string }>;
}

/** Thrown by the placeholder client: the SDK has no tournament transactions yet. */
export class SdkGapError extends Error {
    constructor(method: string) {
        super(
            `${method} needs an SDK release with the tournament transactions (MsgCreateTournament / MsgRegisterTournament / MsgUnregisterTournament). ` +
                "The chain has them; @block52/poker-vm-sdk 1.24.0 does not."
        );
        this.name = "SdkGapError";
    }
}

export const isSdkGapError = (err: unknown): err is SdkGapError => err instanceof SdkGapError;

const sdkGapClient: TournamentTxClient = {
    createTournament: () => Promise.reject(new SdkGapError("Creating a tournament")),
    registerTournament: () => Promise.reject(new SdkGapError("Registering for a tournament")),
    unregisterTournament: () => Promise.reject(new SdkGapError("Unregistering from a tournament"))
};

/** The tournament transaction client. Today the SDK-gap placeholder; see the file header. */
export const getTournamentTxClient = (): TournamentTxClient => sdkGapClient;
