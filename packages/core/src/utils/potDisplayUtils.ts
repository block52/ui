import { isTournamentFormat, isSitAndGoFormat, GameFormat, TexasHoldemRound, PotDTO } from "@block52/poker-vm-sdk";
import { formatUSDCToSimpleDollars } from "./numberUtils";
import { hasElements } from "./guards";
import type { PotName } from "./potTextUtils";

/** One pot on the board: the main pot or a side pot (ui#918). */
export interface PotEntry {
    /** "Main Pot", "Side Pot", or "Side Pot 2" when there is more than one. */
    label: PotName;
    /** Formatted size, for the text label. */
    amount: string;
    /** Raw size (micro-USDC for cash, chips for tournaments), for the chip stack. */
    raw: bigint;
    /** Seats that can win this pot, when the engine sends potDetails (SDK 1.23.0+). */
    eligibleSeats?: number[];
}

export interface PotDisplayValues {
    totalPot: string;
    mainPot: string;
    /** Raw pot sizes (micro-USDC for cash, chips for tournaments) — drive the chip stacks in the pot pill. */
    totalPotRaw: bigint;
    mainPotRaw: bigint;
    isTournamentStyle: boolean;
    isPreflop: boolean;
    /** False while the pot is empty (new-hand setup, before blinds are in) — "Total Pot: 0" is noise (#639). */
    showTotalPot: boolean;
    /** Main Pot is a second row only when it tells you something: post-flop AND different from Total Pot (#639). */
    showMainPot: boolean;
    /** Every pot from completed rounds, main pot first then side pots (ui#918). Empty pots are left out. */
    pots: PotEntry[];
    /** True when there is at least one side pot: the board shows one pill per pot instead of a single Main Pot. */
    showSidePots: boolean;
}

/**
 * The name of pot `index` out of `count` (ui#918): the first is the main pot;
 * a lone side pot is just "Side Pot", otherwise they are numbered from 1.
 */
export function potLabel(index: number, count: number): PotName {
    if (index === 0) return "Main Pot";
    return count > 2 ? `Side Pot ${index}` : "Side Pot";
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
 * @param potDetails - Each pot's eligible seats, index-aligned with `pots` (SDK 1.23.0+; absent on older engines)
 */
export function formatPotDisplay(
    pots: string[],
    totalPot: string | undefined,
    gameFormat: GameFormat | undefined,
    round?: TexasHoldemRound,
    potDetails?: PotDTO[]
): PotDisplayValues {
    const mainPotRaw = hasElements(pots) ? BigInt(pots[0]) : 0n;
    const totalPotRaw = totalPot ? BigInt(totalPot) : mainPotRaw;

    const isTournamentStyle = isTournamentFormat(gameFormat) || isSitAndGoFormat(gameFormat);
    const isPreflop = !round || round === TexasHoldemRound.PREFLOP || round === TexasHoldemRound.ANTE;

    const format = (raw: bigint): string => {
        if (isTournamentStyle) return raw === 0n ? "0" : formatChipCount(Number(raw));
        return raw === 0n ? "0.00" : formatUSDCToSimpleDollars(raw.toString());
    };

    // Main pot first, then side pots (poker-vm#2769). An older engine always
    // sends one entry, so this is a single pot and the board looks as before.
    const allPots = (pots ?? []).map((pot, index) => ({ index, raw: BigInt(pot || "0") }));
    const count = allPots.length;
    const potEntries: PotEntry[] = allPots
        .filter(pot => pot.raw > 0n)
        .map(({ index, raw }) => ({
            label: potLabel(index, count),
            amount: format(raw),
            raw,
            eligibleSeats: potDetails?.[index]?.eligibleSeats
        }));
    const showSidePots = !isPreflop && potEntries.length > 1;

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
        totalPotRaw,
        mainPotRaw,
        isTournamentStyle,
        isPreflop,
        showTotalPot: totalPotRaw > 0n,
        // With side pots the Main Pot is one of the per-pot pills instead.
        showMainPot: !showSidePots && !isPreflop && mainPotRaw > 0n && mainPotRaw !== totalPotRaw,
        pots: potEntries,
        showSidePots
    };
}
