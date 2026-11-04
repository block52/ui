import { t } from "../i18n";

/** A pot's name on the board; side pots are numbered when there is more than one (ui#918). */
export type PotName = "Main Pot" | "Side Pot" | `Side Pot ${number}`;
export type PotLabel = "Total Pot" | PotName;

/** A pot's name in the player's language. */
export function potLabelText(label: PotLabel | "Pot"): string {
    if (label === "Total Pot") return t("felt.totalPot");
    if (label === "Main Pot") return t("banner.mainPot");
    if (label === "Side Pot") return t("banner.sidePot");
    if (label === "Pot") return t("bet.pot");
    return t("banner.sidePotNumber", { number: label.replace("Side Pot ", "") });
}

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
        return `${potLabelText(label)}: ${amount}`;
    }
    return `${potLabelText(label)}: $${amount}`;
}
