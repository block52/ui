/**
 * The chain's tournament record and its pieces, re-exported from the SDK
 * (Commandment 1): @block52/poker-vm-sdk 1.27.0 publishes the engine's
 * TournamentStateDTO (poker-vm#2613), so the local mirror this file used to
 * carry is gone. Import sites keep their `types/tournament` path; the shapes
 * are the SDK's, which also adds 1.27.0's `lateRegistrationLevels` and makes
 * `intents` required (parseTournamentStateDTO normalizes it).
 */
export type {
    MoveIntentDTO,
    TournamentEntrantDTO,
    TournamentOptionsDTO,
    TournamentStateDTO,
    TournamentTableDTO
} from "@block52/poker-vm-sdk";

/**
 * Response of the tournament query: the state is a JSON string.
 *
 * TODO(sdk): the SDK defines QueryTournamentResponse in types/rest.ts but does
 * not export it from the package root; switch to it when it does.
 */
export type TournamentResponse = { tournament: string };
