/**
 * The game types a player can CREATE (ui#823): Cash Game, Sit & Go and
 * Tournament. The chain knows only two creatable formats today — `cash` and
 * `sit-and-go` (`tournament` is reserved for the multi-table layer,
 * poker-vm#2613, and refused by MsgCreateGame) — so the UI's **Tournament** is
 * a sit-and-go with a scheduled start time (poker-vm#2680): it starts at that
 * time with whoever has registered, or earlier when full. A plain Sit & Go
 * starts only when full.
 *
 * Keeping the distinction here, in one tested place, means the create forms,
 * the lobby and the table header agree on what to call a table, and when MTTs
 * land only {@link createGameTypeFormat} has to change.
 */
import { GameFormat } from "@block52/poker-vm-sdk";
import { hasValue } from "./guards";

export type CreateGameType = "cash" | "sit-and-go" | "tournament";

export const CREATE_GAME_TYPES: readonly CreateGameType[] = ["sit-and-go", "cash", "tournament"];

/** Coerce a raw select value into a CreateGameType, undefined for anything else. */
export const toCreateGameType = (value: string | undefined): CreateGameType | undefined =>
    value === "cash" || value === "sit-and-go" || value === "tournament" ? value : undefined;

/** The label the create forms show for a type. */
export const createGameTypeLabel = (type: CreateGameType): string => {
    switch (type) {
        case "cash":
            return "Cash Game";
        case "sit-and-go":
            return "Sit & Go";
        case "tournament":
            return "Tournament";
    }
};

/** The chain format a type is created as: a Tournament is a (scheduled) sit-and-go today. */
export const createGameTypeFormat = (type: CreateGameType): GameFormat => (type === "cash" ? GameFormat.CASH : GameFormat.SIT_AND_GO);

/** Whether a type carries a start time (the Tournament type always does). */
export const isScheduledCreateType = (type: CreateGameType): boolean => type === "tournament";

/**
 * What to call a table the lobby and the table header are showing: a
 * sit-and-go with a scheduled start is a **Tournament**; everything else keeps
 * the SDK's format display ("Sit And Go", "Cash", and legacy "Tournament").
 */
export const displayGameFormat = (format: GameFormat | "unknown" | null | undefined, scheduledStartTime: number | undefined, fallback: (format: GameFormat | "unknown") => string): string => {
    if (!hasValue(format)) return "";
    if (format === GameFormat.SIT_AND_GO && hasValue(scheduledStartTime) && scheduledStartTime > 0) return "Tournament";
    return fallback(format);
};
