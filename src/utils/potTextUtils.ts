export type PotLabel = "Total Pot" | "Main Pot";

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
