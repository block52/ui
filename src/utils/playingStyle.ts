/**
 * The profile's Playing Style figures (ui#1012): what each one means, worded
 * for how the indexer computes it (block52/indexer#27), and how to show it.
 *
 * The indexer serves VPIP, PFR, WTSD and W$SD as integers scaled x100 over
 * the player's hands (W$SD over the showdowns they reached), and aggression as
 * (bets + raises) / calls x100. With no hands, or no calls for aggression, the
 * indexer stores 0; that is no figure at all, so it shows as a dash.
 */
import type { PlayerProfile } from "@block52/poker-ui-core/types/players";
import { formatScaledPercent } from "./vip";

export type PlayingStyleKey = "vpip" | "pfr" | "aggression_factor" | "wtsd" | "won_at_showdown";

/** The tile title, the full name shown in bold in the explanation, and the rest of the explanation. */
export interface PlayingStyleFigure {
    key: PlayingStyleKey;
    title: string;
    name: string;
    explanation: string;
}

export const PLAYING_STYLE_FIGURES: readonly PlayingStyleFigure[] = [
    {
        key: "vpip",
        title: "VPIP",
        name: "Voluntarily put money in pot",
        explanation:
            "Of the hands you were dealt, how often you put chips in preflop by choice, calling or raising, not just posting a blind. It shows how loose you play."
    },
    {
        key: "pfr",
        title: "PFR",
        name: "Preflop raise",
        explanation: "Of the hands you were dealt, how often you raised preflop. It shows how aggressive you are before the flop."
    },
    {
        key: "aggression_factor",
        title: "Aggression",
        name: "Aggression factor",
        explanation: "Your bets and raises divided by your calls, on every street. Above 1 means you bet or raise more often than you call."
    },
    {
        key: "wtsd",
        title: "WTSD",
        name: "Went to showdown",
        explanation: "Of the hands you were dealt, how often you reached showdown."
    },
    {
        key: "won_at_showdown",
        title: "W$SD",
        name: "Won money at showdown",
        explanation: "Of the hands where you reached showdown, how often you won chips."
    }
];

const NO_FIGURE = "—";

/** A figure's value as the tile shows it: "25.50%", "1.27", or a dash when there's nothing to measure. */
export function formatPlayingStyle(key: PlayingStyleKey, profile: PlayerProfile): string {
    if (profile.total_hands === 0) return NO_FIGURE;
    if (key === "aggression_factor") {
        return profile.total_calls === 0 ? NO_FIGURE : (profile.aggression_factor / 100).toFixed(2);
    }
    return formatScaledPercent(profile[key]);
}
