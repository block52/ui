/** A pot's name on the board; side pots are numbered when there is more than one (ui#918). */
export type PotName = "Main Pot" | "Side Pot" | `Side Pot ${number}`;
export type PotLabel = "Total Pot" | PotName;

/**
 * Formats a pot label with its amount for display.
 * Cash games show a $ prefix, tournaments show raw chip count.
 */
export function formatPotLabel(
    label: PotLabel,
    amount: string,
    isTournamentStyle: boolean
): string {
    if (isTournamentStyle) {
        return `${label}: ${amount}`;
    }
    return `${label}: $${amount}`;
}
