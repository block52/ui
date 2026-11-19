/**
 * Colour of a Session History cash-out against that row's buy-in.
 *
 * The table prints both amounts with formatMicroUsd, which ceilings to cents.
 * A raw cash-out that is a fraction of a cent above its buy-in still reads as
 * the same 2.00 / 2.00, so the comparison uses those displayed cents. An
 * unknown cash-out (the em dash for a seat still open) is not a result.
 */
import { hasValue, isNumber } from "./guards";
import { formatMicroUsd } from "./moneyDisplay";

/** Cash-out above the buy-in, below it, or the same once both are shown to cents. */
export type SessionCashOutTone = "profit" | "loss" | "even";

const DISPLAYED_CENTS = /^(-?)(\d+)\.(\d{2})$/;

/** Cents formatMicroUsd will print, or undefined when it would print an em dash. */
function displayedCents(micro: number): bigint | undefined {
    if (!isNumber(micro) || !Number.isFinite(micro)) return undefined;
    const match = DISPLAYED_CENTS.exec(formatMicroUsd(micro));
    if (!hasValue(match)) return undefined;
    const cents = BigInt(match[2]) * 100n + BigInt(match[3]);
    return match[1] === "-" ? -cents : cents;
}

/**
 * Compare a cash-out with its buy-in using the cents the table shows.
 * Undefined when either amount is missing or would not display as a number,
 * which is how a "—" cash-out stays uncoloured.
 */
export function compareSessionCashOut(buyInMicro: number, cashOutMicro: number | undefined): SessionCashOutTone | undefined {
    if (!isNumber(cashOutMicro)) return undefined;
    const buyIn = displayedCents(buyInMicro);
    const cashOut = displayedCents(cashOutMicro);
    if (!hasValue(buyIn) || !hasValue(cashOut)) return undefined;
    if (cashOut > buyIn) return "profit";
    if (cashOut < buyIn) return "loss";
    return "even";
}

/**
 * Profit/loss colour for the cash-out number only.
 * Same classes as net profit elsewhere: text-green-400 / text-red-400,
 * which the light theme remaps inside .site-page. Even and unknown stay
 * on the cell's own colour, so the class is empty.
 */
export function sessionCashOutAmountClass(buyInMicro: number, cashOutMicro: number | undefined): string {
    const tone = compareSessionCashOut(buyInMicro, cashOutMicro);
    if (tone === "profit") return "text-green-400";
    if (tone === "loss") return "text-red-400";
    return "";
}

/**
 * Prize cash-out on a Session History row.
 * Phones stack the PRIZE badge above the place and amount so a 390px
 * Cash-Out cell can show the whole figure. From sm up they stay on one line.
 */
export function sessionPrizeCashOutClass(): string {
    return "flex w-full max-w-full flex-col items-end gap-0.5 hover:text-white sm:inline-flex sm:w-auto sm:flex-row sm:items-center sm:gap-2";
}

/** Place and amount stay side by side on every width. The amount keeps its profit/loss colour. */
export function sessionPrizeAmountRowClass(): string {
    return "inline-flex max-w-full items-center justify-end gap-1 whitespace-nowrap sm:gap-2";
}
