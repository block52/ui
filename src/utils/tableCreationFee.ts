import type { GameFormat } from "@block52/poker-vm-sdk";
import { convertBlindsForBlockchain, isTournamentFormat } from "./gameFormatUtils";
import { usdcToMicroBigInt } from "../constants/currency";

/** The table creation fee, in big blinds (block52/pokerchain#378). */
export const CREATION_FEE_BIG_BLINDS = 10n;

/**
 * Micro-USDC the chain debits to create a table. Mirrors pokerchain
 * `x/poker/types/creation_fee.go` `GameCreationFee` exactly (block52/ui#690):
 *
 *   - Cash: 10 × big blind (micro-USDC).
 *   - Sit & Go / Tournament: the big blind is in CHIPS, so the fee is the USDC
 *     value of 10 big blinds at the buy-in's chip price:
 *     floor(10 × big blind × buy-in ÷ starting stack).
 *
 * Takes the same form values the create hook submits and runs them through the
 * same conversions (`convertBlindsForBlockchain`, `usdcToMicroBigInt`), so the
 * preview equals the debit. Returns null when the chain could not price it
 * (it rejects a zero big blind or starting stack) — never a default.
 */
export function computeTableCreationFeeMicro(
    format: GameFormat,
    smallBlind: number,
    bigBlind: number,
    buyInUsdc: number,
    startingStack: number | undefined
): bigint | null {
    const { bigBlind: bigBlindUnits } = convertBlindsForBlockchain(format, smallBlind, bigBlind);
    if (bigBlindUnits <= 0n) {
        return null;
    }
    const fee = CREATION_FEE_BIG_BLINDS * bigBlindUnits;
    if (!isTournamentFormat(format)) {
        return fee;
    }
    if (!startingStack || startingStack <= 0) {
        return null;
    }
    return (fee * usdcToMicroBigInt(buyInUsdc)) / BigInt(Math.floor(startingStack));
}
