import { BigUnit } from "bigunit";
import { ethers } from "ethers";
import { microToUsdc, USDC_TO_MICRO } from "../constants/currency";

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
 * @deprecated This function uses 18 decimals (Wei format) but USDC uses 6 decimals.
 * Use formatMicroAsUsdc() from constants/currency.ts for USDC amounts.
 * Only use this function for actual ETH amounts.
 */
export const formatWeiToDollars = (weiAmount: string | bigint | undefined | null): string => {
    try {
        // Handle undefined or null values
        if (weiAmount === undefined || weiAmount === null) {
            return "0.00";
        }

        // Convert from Wei (18 decimals) to standard units
        const usdValue = Number(ethers.formatUnits(weiAmount.toString(), 18));

        // Format to always show 2 decimal places
        return usdValue.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    } catch (error) {
        console.error("Error formatting Wei amount:", error);
        return "0.00";
    }
};

/**
 * @deprecated This function uses 18 decimals (Wei format) but USDC uses 6 decimals.
 * Use formatMicroAsUsdc() from constants/currency.ts for USDC amounts.
 * Only use this function for actual ETH amounts.
 */
export const formatWeiToSimpleDollars = (weiAmount: string | bigint | undefined | null): string => {
    try {
        // Handle undefined or null values
        if (weiAmount === undefined || weiAmount === null) {
            return "0.00";
        }

        const etherValue = ethers.formatUnits(weiAmount.toString(), 18);
        return parseFloat(etherValue).toFixed(2);
    } catch (error) {
        console.error("Error formatting Wei amount:", error);
        return "0.00";
    }
};

/**
 * @deprecated This function uses 18 decimals (Wei format) but USDC uses 6 decimals.
 * Use formatMicroAsUsdc() from constants/currency.ts for USDC amounts.
 * Only use this function for actual ETH amounts.
 */
export const formatWeiToUSD = (weiAmount: string | number | undefined | null): string => {
    try {
        // Handle undefined or null values
        if (weiAmount === undefined || weiAmount === null) {
            return "0.00";
        }

        // Convert from Wei (18 decimals) to standard units
        const usdValue = Number(ethers.formatUnits(weiAmount.toString(), 18));
        // Format to 2 decimal places and add commas
        return usdValue.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    } catch (error) {
        console.error("Error formatting Wei amount:", error);
        return "0.00";
    }
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
        if (usdcAmount === undefined || usdcAmount === null) {
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
 * @deprecated This function has incorrect conversion logic. USDC values should be in
 * micro-USDC format (6 decimals), not Wei format (18 decimals).
 * Use formatMicroAsUsdc() from constants/currency.ts instead.
 */
export const formatChipAmount = (chipAmount: string | bigint | undefined | null): string => {
    try {
        // Handle undefined or null values
        if (chipAmount === undefined || chipAmount === null) {
            return "0.00";
        }

        // Convert from Wei format (18 decimals) to USDC-compatible format
        // Divide by 10^14 to get the correct USDC amount, then format with 6 decimals
        const converted = BigInt(chipAmount.toString()) / BigInt("100000000000000");
        const usdcValue = ethers.formatUnits(converted.toString(), 6);
        return parseFloat(usdcValue).toFixed(2);
    } catch (error) {
        console.error("Error formatting chip amount:", error);
        return "0.00";
    }
};

/** Format a numeric dollar value for display: "12.50" */
export function formatDollars(value: number): string {
    return value.toFixed(2);
}

/** Parse a dollar string back to a number. Returns NaN if invalid. */
export function parseDollars(str: string): number {
    return parseFloat(str);
}
