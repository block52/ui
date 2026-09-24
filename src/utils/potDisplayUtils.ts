import { isTournamentFormat, isSitAndGoFormat, GameFormat, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { formatUSDCToSimpleDollars } from "./numberUtils";
import { hasElements } from "./guards";

export interface PotDisplayValues {
    totalPot: string;
    mainPot: string;
    isTournamentStyle: boolean;
    isPreflop: boolean;
    /** False while the pot is empty (new-hand setup, before blinds are in) — "Total Pot: 0" is noise (#639). */
    showTotalPot: boolean;
    /** Main Pot is a second row only when it tells you something: post-flop AND different from Total Pot (#639). */
    showMainPot: boolean;
}

/**
 * Format chip counts for tournament display with commas.
 */
export function formatChipCount(chips: number): string {
    return chips.toLocaleString("en-US");
}

/**
 * Computes formatted pot display values from raw game state.
 *
 * @param pots - Array of pot strings from gameState (pots[0] = main pot)
 * @param totalPot - Total pot string from gameState (main pot + current round bets)
 * @param gameFormat - The game format (cash, tournament, sit-and-go)
 * @param round - The current round (PREFLOP, FLOP, TURN, RIVER, etc.)
 */
export function formatPotDisplay(
    pots: string[],
    totalPot: string | undefined,
    gameFormat: GameFormat | undefined,
    round?: TexasHoldemRound
): PotDisplayValues {
    const mainPotRaw = hasElements(pots) ? BigInt(pots[0]) : 0n;
    const totalPotRaw = totalPot ? BigInt(totalPot) : mainPotRaw;

    const isTournamentStyle = isTournamentFormat(gameFormat) || isSitAndGoFormat(gameFormat);
    const isPreflop = !round || round === TexasHoldemRound.PREFLOP || round === TexasHoldemRound.ANTE;

    let totalPotFormatted: string;
    let mainPotFormatted: string;

    if (isTournamentStyle) {
        totalPotFormatted = totalPotRaw === 0n ? "0" : formatChipCount(Number(totalPotRaw));
        mainPotFormatted = mainPotRaw === 0n ? "0" : formatChipCount(Number(mainPotRaw));
    } else {
        totalPotFormatted = totalPotRaw === 0n ? "0.00" : formatUSDCToSimpleDollars(totalPotRaw.toString());
        mainPotFormatted = mainPotRaw === 0n ? "0.00" : formatUSDCToSimpleDollars(mainPotRaw.toString());
    }

    return {
        totalPot: totalPotFormatted,
        mainPot: mainPotFormatted,
        isTournamentStyle,
        isPreflop,
        showTotalPot: totalPotRaw > 0n,
        showMainPot: !isPreflop && mainPotRaw > 0n && mainPotRaw !== totalPotRaw
    };
}
