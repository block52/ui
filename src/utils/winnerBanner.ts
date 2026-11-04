import { hasElements, isNumber } from "./guards";
import { potLabel } from "./potDisplayUtils";

/**
 * Builds the last-pot winner banner text (ui#848) from the resolved winners.
 * Pure + typed so it can be unit-tested apart from the component.
 */
export interface BannerWinner {
    seat: number;
    /** "0.03" for cash (USDC), "1,240 chips" for SNG/tournaments. */
    formattedAmount: string;
    handName?: string;
    /** The engine's hand description, e.g. "Full House, 8s over 7s", shown as-is. */
    description?: string;
    /** "showdown" shows the winning hand; "uncontested" just shows the amount. */
    winType?: string;
    /** This winner's share of each pot, main pot first (ui#918). */
    pots?: { pot: number; formattedAmount: string }[];
}

/** A cash amount arrives as a bare decimal ("0.03"); tournament amounts already say "chips". */
const isCashAmount = (formattedAmount: string): boolean => /^[\d,.]+$/.test(formattedAmount);

/** "$0.03" for cash, "1,240 chips" unchanged. */
function bannerAmount(formattedAmount: string): string {
    return isCashAmount(formattedAmount) ? `$${formattedAmount}` : formattedAmount;
}

/** "the $0.03 pot" for cash; "1,240 chips" for tournaments. */
function wonPhrase(formattedAmount: string): string {
    return isCashAmount(formattedAmount) ? `the ${bannerAmount(formattedAmount)} pot` : formattedAmount;
}

/**
 * "Seat 3 wins the $12.50 pot with Full House, 8s over 7s", or for a
 * split pot "Split pot — Seat 3 $6.25 · Seat 5 $6.25". Null when there are no
 * winners.
 */
/**
 * Side pots (ui#918): one phrase per pot, main pot first, e.g. "Main Pot $24.40
 * to Seat 9 \u00b7 Side Pot $4.00 to Seat 2". Null when the engine didn't send
 * per-pot shares or there was only one pot, so the caller keeps the old text.
 */
function perPotBannerText(winners: BannerWinner[]): string | null {
    if (!winners.every(w => hasElements(w.pots))) return null;
    const byPot = new Map<number, { seat: number; formattedAmount: string }[]>();
    for (const w of winners) {
        for (const share of w.pots!) {
            const shares = byPot.get(share.pot) ?? [];
            shares.push({ seat: w.seat, formattedAmount: share.formattedAmount });
            byPot.set(share.pot, shares);
        }
    }
    if (byPot.size < 2) return null;
    const indexes = [...byPot.keys()].sort((a, b) => a - b);
    const count = indexes[indexes.length - 1] + 1;
    const phrases = indexes.map(index => {
        const shares = byPot.get(index)!;
        const label = potLabel(index, count);
        if (shares.length === 1) return `${label} ${bannerAmount(shares[0].formattedAmount)} to Seat ${shares[0].seat}`;
        return `${label} split: ${shares.map(s => `Seat ${s.seat} ${bannerAmount(s.formattedAmount)}`).join(" & ")}`;
    });
    // One player scooping every pot: no per-pot list, just the total (and their hand).
    if (winners.length === 1) {
        const w = winners[0];
        const hand = w.description || w.handName;
        const suffix = w.winType === "showdown" && hand ? ` with ${hand}` : "";
        return `Seat ${w.seat} wins Total Pot ${bannerAmount(w.formattedAmount)}${suffix}`;
    }
    return phrases.join(" \u00b7 ");
}

export function winnerBannerText(winners: BannerWinner[] | null | undefined): string | null {
    if (!hasElements(winners)) return null;
    const perPot = perPotBannerText(winners);
    if (perPot) return perPot;
    if (winners.length === 1) {
        const w = winners[0];
        const engineHand = w.description || w.handName;
        // The engine's wording as-is, so the banner matches the seat labels and
        // hand log (wording changes belong upstream in the engine — see poker-vm).
        const hand = w.winType === "showdown" && engineHand ? ` with ${engineHand}` : "";
        return `Seat ${w.seat} wins ${wonPhrase(w.formattedAmount)}${hand}`;
    }
    return `Split pot — ${winners.map(w => `Seat ${w.seat} ${bannerAmount(w.formattedAmount)}`).join(" · ")}`;
}

/** Gap between the table's info bar and the banner (px). */
const BANNER_GAP_PX = 8;
/** Where the banner sits when there is no info bar to measure (px from the top). */
const BANNER_FALLBACK_TOP_PX = 108;

/**
 * The banner's top edge (px from the viewport top): just under the table's info
 * bar ("$0.01 / $0.02 · Hand #34 …"), whose height depends on the window size —
 * the header wraps to two lines in a narrow window, so a fixed offset can land
 * inside it.
 *
 * @param infoBarBottom The info bar's bottom edge, or null when it isn't rendered
 */
export function winnerBannerTop(infoBarBottom: number | null | undefined): number {
    return isNumber(infoBarBottom) ? Math.round(infoBarBottom) + BANNER_GAP_PX : BANNER_FALLBACK_TOP_PX;
}

/** How far past each clip edge the pill starts and finishes (px), so not even a sliver shows. */
export const BANNER_EDGE_MARGIN_PX = 6;

/**
 * How far the pill travels (px): from just past the window's right edge to just
 * past its left — the window's width, the pill's own width, and a margin at each
 * end. A plain pixel distance keeps the roll on the compositor (smooth even while
 * the table re-renders), unlike a calc() of vw and %.
 *
 * @param trackWidth The visible window's width (px)
 * @param pillWidth The pill's rendered width (px)
 */
export function winnerBannerRollDistance(trackWidth: number, pillWidth: number): number {
    return Math.round(trackWidth + pillWidth + 2 * BANNER_EDGE_MARGIN_PX);
}
