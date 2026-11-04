import { useRef } from "react";

/**
 * The value, held at what it was when `frozen` became true (ui#944): a player's
 * countdown stops the moment they act, instead of running on for up to a block
 * until the chain confirms it. If the move is refused, `frozen` clears and the
 * real value returns.
 */
export const useFrozenWhile = <T,>(value: T, frozen: boolean): T => {
    const held = useRef(value);
    if (!frozen) {
        held.current = value;
    }
    return held.current;
};
