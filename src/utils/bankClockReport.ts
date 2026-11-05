import { hasContent, hasValue, isNullish } from "./guards";

/**
 * What the player's own countdown has spent of their time bank, per table
 * (ui#944). Block times are too coarse to charge by, so the move carries this
 * and the engine charges the larger of it and its own measure
 * (block52/poker-vm settleTimeBank). Set by usePlayerTimer, read when the move
 * is sent, which happens outside React.
 */
const bankStartByTable = new Map<string, number>();

/** When the bank starts counting on this table's current turn, or null when no bank is in play. */
export const setBankClockStart = (tableId: string, startMs: number | null): void => {
    if (hasValue(startMs)) {
        bankStartByTable.set(tableId, startMs);
    } else {
        bankStartByTable.delete(tableId);
    }
};

/** The action data for a move sent now: `bankSpentMs=<ms>`, or undefined when no bank has been spent. */
export const bankSpentData = (tableId: string, nowMs: number): string | undefined => {
    const startMs = bankStartByTable.get(tableId);
    if (isNullish(startMs) || nowMs <= startMs) {
        return undefined;
    }
    return `bankSpentMs=${Math.round(nowMs - startMs)}`;
};

/** Merge into data the action already carries. */
export const withBankSpentData = (data: string | undefined, bankData: string | undefined): string | undefined => {
    if (isNullish(bankData)) {
        return data;
    }
    return hasContent(data) ? `${data}&${bankData}` : bankData;
};
