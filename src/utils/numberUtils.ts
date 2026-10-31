import { BigUnit } from "bigunit";
import { ethers } from "ethers";
import { microToUsdc, USDC_TO_MICRO } from "../constants/currency";
import { hasValue, isBlank, isNullish } from "./guards";

/**
 * Format a USDC balance from micro-units (6 decimals) to display format
 * @param balance The balance in micro-USDC (e.g., "1500000" = $1.50)
 * @returns Formatted string with 2 decimal places
 */
export const formatBalance = (balance: string | number): string => {
    const value = Number(balance) / USDC_TO_MICRO; // USDC uses 6 decimals
    return formatToFixed(value);
};

export const formatToFixed = (value: number): string => {
    return value.toFixed(2);
};

/**
 * Format a USDC value from micro-units (6 decimals) to display format
 * @param value The value in micro-USDC
 * @returns Formatted string with 2 decimal places
 */
export const formatToFixedFromString = (value: string | number): string => {
    return microToUsdc(value).toFixed(2);
};


/**
 * Formats a winning amount with appropriate styling
 * @param amount The winning amount in ETH as a string
 * @returns Formatted string for display
 */
export const formatWinningAmount = (amount: string): string => {
    // Convert to a number and format it with commas
    const numAmount = parseFloat(amount);
    return numAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

/**
 * Converts a string amount to BigInt using specified decimals
 * @param amount The amount as a string
 * @param decimals The number of decimals to use for conversion
 * @returns BigInt representation of the amount
 */
export const convertAmountToBigInt = (amount: string, decimals: number): bigint => {
    if (!decimals || !amount || !+amount) return BigInt(0);
    return BigUnit.from(+amount, decimals).toBigInt();
};

// Format USDC amounts (6 decimals) to simple dollar format
export const formatUSDCToSimpleDollars = (usdcAmount: string | bigint | undefined | null): string => {
    try {
        // Handle undefined or null values
        if (isNullish(usdcAmount)) {
            return "0.00";
        }

        const usdcValue = ethers.formatUnits(usdcAmount.toString(), 6);
        return parseFloat(usdcValue).toFixed(2);
    } catch (error) {
        console.error("Error formatting USDC amount:", error);
        return "0.00";
    }
};

/**
 * Convert USDC microunits (6 decimals) to a number
 * @param microunits The USDC amount in microunits (e.g., "1000000" = $1.00)
 * @returns Number representation (e.g., 1.0)
 */
export const convertUSDCToNumber = (microunits: string | bigint): number => {
    return microToUsdc(String(microunits));
};

/**
 * Format stack values for Sit & Go tournaments
 * Shows whole numbers with comma separators, no dollar sign
 * @param value The stack value as a number
 * @returns Formatted string like "10,000" or "1,500"
 */
export const formatForSitAndGo = (value: number): string => {
    // Round to whole number and add comma separators
    return Math.floor(value).toLocaleString("en-US");
};

/**
 * Format a Sit & Go chip-stack string (the on-the-wire DTO form — Commandment 9)
 * for display, bridging string → number → "1,500"-style output in one place so
 * call sites don't repeat bare `Number(...)` casts (Commandment 12).
 * @param stack Stack value as a string in chip units (NOT USDC microunits)
 * @returns Formatted string like "1,500" or "10,000"
 */
export const formatSitAndGoStackString = (stack: string): string => {
    return formatForSitAndGo(Number(stack));
};

/**
 * Format stack values for Cash Games
 * Shows with dollar sign and 2 decimal places
 * @param value The stack value as a number
 * @returns Formatted string like "$100.00" or "$25.50"
 */
export const formatForCashGame = (value: number): string => {
    // Format with 2 decimal places and dollar sign
    return `$${value.toFixed(2)}`;
};

/**
 * Format an amount for display based on game format.
 * Tournament: whole chips with comma separators (e.g., "1,500")
 * Cash: dollar amount with 2 decimals (e.g., "$25.00")
 * @param value The display value (already converted from micro-units for cash)
 * @param isTournament Whether this is a tournament/SNG game
 * @returns Formatted string
 */
export const formatDisplayAmount = (value: number, isTournament: boolean): string => {
    return isTournament ? formatForSitAndGo(value) : formatForCashGame(value);
};

/**
 * The table's big blind in the same unit as a seat stack (ui#895): chips for
 * tournaments, dollars for cash (the wire value is micro-USDC). Returns null
 * when there is no usable big blind, so callers fall back to $ / chips.
 * @param bigBlind `gameOptions.bigBlind` from the DTO (the current level's blind)
 * @param isTournament Whether this is a tournament/SNG game
 */
export const bigBlindInStackUnits = (bigBlind: string | null | undefined, isTournament: boolean): number | null => {
    if (isNullish(bigBlind) || isBlank(bigBlind)) return null;
    const value = isTournament ? Number(bigBlind) : convertUSDCToNumber(bigBlind);
    return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Format a count of big blinds: one decimal place, dropped for a whole number.
 * @returns e.g. "45.5 BB", "100 BB", "12,345 BB"
 */
export const formatBigBlinds = (bigBlinds: number): string => {
    const rounded = Math.round(bigBlinds * 10) / 10;
    const decimals = Number.isInteger(rounded) ? 0 : 1;
    const text = rounded.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${text} BB`;
};

/**
 * Format a seat's stack (ui#895). In big blinds when the player turned that on
 * for this format and the table has a big blind; otherwise as `formatDisplayAmount`.
 * @param value The stack (already converted from micro-units for cash)
 * @param isTournament Whether this is a tournament/SNG game
 * @param bigBlind The big blind in the same unit as `value` (see `bigBlindInStackUnits`),
 *   or null to show $ / chips
 * @returns e.g. "45.5 BB", "$100.00" or "10,000"
 */
export const formatSeatStack = (value: number, isTournament: boolean, bigBlind: number | null): string => {
    if (hasValue(bigBlind) && bigBlind > 0 && Number.isFinite(value)) {
        return formatBigBlinds(value / bigBlind);
    }
    return formatDisplayAmount(value, isTournament);
};

/**
 * Format the editable bet/raise slider input value.
 * Tournament: whole chips with no separators and no decimals (e.g. "1500") so the
 *   text input stays numerically parseable and never shows fractional chips.
 * Cash: dollars with 2 decimals (e.g. "12.50").
 * @param value The display value (already in chip units for tournaments, dollars for cash)
 * @param isTournament Whether this is a tournament/SNG game
 */
export const formatSliderInputValue = (value: number, isTournament: boolean): string => {
    return isTournament ? String(Math.floor(value)) : value.toFixed(2);
};

/**
 * Parse a raw bet/raise slider input string into a new amount in value-space
 * (i.e. pre-offset — the caller subtracts what was already committed this round).
 * Returns `null` when the raw string is an incomplete or invalid entry that must
 * not yet be committed (e.g. "12." mid-typing for cash, or any non-integer for a
 * tournament), so callers can safely ignore it.
 * @param raw The raw input string from the text box
 * @param displayOffset Amount already committed this round (added to the value for display)
 * @param isTournament Whole-chip (integer) vs cash (up to 2 decimals) parsing
 */
export const parseSliderInput = (raw: string, displayOffset: number, isTournament: boolean): number | null => {
    if (isBlank(raw)) return 0;

    if (isTournament) {
        // Tournaments are whole chips only — reject anything with a decimal point.
        if (!/^\d+$/.test(raw)) return null;
        return Math.max(0, Math.floor(parseInt(raw, 10) - displayOffset));
    }

    // Cash: allow partial entry (e.g. "12.") but only commit a complete number.
    if (!/^\d*\.?\d{0,2}$/.test(raw)) return null;
    if (!/^\d*\.?\d{1,2}$/.test(raw) || isNaN(Number(raw))) return null;
    return Math.max(0, parseFloat(raw) - displayOffset);
};

/** Format a numeric dollar value for display: "12.50" */
export function formatDollars(value: number): string {
    return value.toFixed(2);
}

/** Parse a dollar string back to a number. Returns NaN if invalid. */
export function parseDollars(str: string): number {
    return parseFloat(str);
}
