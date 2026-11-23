/**
 * Session History labels and filter options (ui#1012), from the game format
 * and variant the indexer joins onto each session.
 *
 * A missing or unrecognised format or variant gets no label (the row shows
 * only its game id) and no filter option: nothing is filled in with a guessed
 * format or a default variant.
 */
import { GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { hasValue } from "@block52/ui-sdk/helpers";
import type { PlayerSessionFilter, SessionGameCount } from "../types/players";
import { toGameFormat, toGameVariant } from "./gameFormatUtils";

const FORMAT_LABELS: Record<GameFormat, string> = {
    [GameFormat.CASH]: "Cash Game",
    [GameFormat.SIT_AND_GO]: "Sit & Go",
    [GameFormat.TOURNAMENT]: "Tournament"
};

const VARIANT_LABELS: Record<GameVariant, string> = {
    [GameVariant.TEXAS_HOLDEM]: "Texas Hold'em",
    [GameVariant.OMAHA]: "Omaha"
};

/** "Sit & Go · Texas Hold'em", or undefined when either half is missing or unrecognised. */
export function sessionGameLabel(format: string | undefined, variant: string | undefined): string | undefined {
    const f = toGameFormat(format);
    const v = toGameVariant(variant);
    if (!hasValue(f) || !hasValue(v)) return undefined;
    return `${FORMAT_LABELS[f]} · ${VARIANT_LABELS[v]}`;
}

/** One entry in the Session History game menu. */
export interface SessionGameOption {
    /** "cash:texas-holdem": the menu value. */
    key: string;
    /** "Cash Game · Texas Hold'em" */
    label: string;
    sessions: number;
    filter: Required<PlayerSessionFilter>;
}

/** The menu value that shows every session. */
export const ALL_SESSION_GAMES = "all";

/**
 * Menu entries for the kinds of game a player has sessions at, in the
 * indexer's order (most played first). Kinds this build can't name are left
 * out; undefined (an indexer without the counts) gives no entries.
 */
export function sessionGameOptions(games: SessionGameCount[] | undefined): SessionGameOption[] {
    if (!hasValue(games)) return [];
    return games.flatMap(game => {
        const label = sessionGameLabel(game.game_format, game.game_variant);
        if (!hasValue(label)) return [];
        return [
            {
                key: `${game.game_format}:${game.game_variant}`,
                label,
                sessions: game.sessions,
                filter: { game_format: game.game_format, game_variant: game.game_variant }
            }
        ];
    });
}
