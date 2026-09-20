import { useState, useEffect, useRef } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import { useAnimationAck } from "./useAnimationAck";
import { CardAnimationsReturn } from "../../types/index";
// The card drop-in duration (Table.css `.animate-fall` runs for the same
// `--card-drop-ms`). The ack fires this long after the LAST slot is revealed,
// i.e. when the last staggered drop actually finishes on screen — comfortably
// inside the decorator's ackTimeoutMs budget, which is built from the same number.
import { CARD_DROP_MS } from "../../bus/timing";

/** Community-card board slots: flop (0–2), turn (3), river (4). */
const BOARD_SLOTS = 5;

const allHidden = (): boolean[] => new Array<boolean>(BOARD_SLOTS).fill(false);

/**
 * Custom hook to handle community-card deal animations.
 *
 * Driven by the WS Action Bus: it consumes the committed item's `dealCards`
 * animation hint (from the communityCardStagger decorator) plus the derived
 * `handStarted` event, and exposes a per-slot revealed state that `TableBoard`
 * gates each card's drop-in on. The newly-dealt cards of a street drop in one at
 * a time (staggered by the hint's `staggerMs`), while cards from earlier streets
 * stay on the board. This:
 *
 *   - drops the flop in ONE CARD AT A TIME (each card appears when its staggered
 *     flag turns on, not all at once);
 *   - RE-TRIGGERS on turn and river, mapping the new card to its ABSOLUTE board
 *     slot (3 / 4) — the old model was flop-only and street-relative; and
 *   - RESETS per hand on `handStarted` (the board clears).
 *
 * @param _tableId The ID of the table (not used - Context manages subscription)
 * @returns Object containing per-slot revealed state for the community cards
 */
export const useCardAnimations = (_tableId?: string): CardAnimationsReturn => {
    const { gameState } = useGameStateContext();
    const { latestItem } = useGameEventsContext();
    const ackDone = useAnimationAck(latestItem?.decoration.animations ?? []);

    const communityCards = gameState?.communityCards || [];
    const cardCount = communityCards.length;

    // Late mount / replay (page opened mid-hand): show already-dealt cards
    // immediately, with no animation, so a refresh never leaves the board empty.
    const [revealedSlots, setRevealedSlots] = useState<boolean[]>(() =>
        Array.from({ length: BOARD_SLOTS }, (_, i) => i < cardCount)
    );

    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    // Slots with an in-flight staggered drop; a non-deal commit must not clobber them.
    const animatingRef = useRef<Set<number>>(new Set());

    const clearTimers = () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    };

    useEffect(() => {
        if (!latestItem) return;

        // Reset per hand: a new hand clears the board, so hide all slots.
        const handStarted = latestItem.events.some(event => event.type === "handStarted");
        if (handStarted) {
            clearTimers();
            animatingRef.current = new Set();
            setRevealedSlots(allHidden());
            return;
        }

        // The communityCardStagger decorator attaches a `dealCards` hint carrying
        // the newly-dealt cards and the per-card stagger whenever the street
        // advances with new community cards.
        const dealHint = latestItem.decoration.animations.find(animation => animation.kind === "dealCards");

        if (!dealHint) {
            // Non-deal commit (a player action): reconcile visibility without
            // disturbing an in-flight stagger. Cards already on the board stay
            // revealed; undealt slots stay hidden.
            setRevealedSlots(prev => {
                const next = [...prev];
                for (let i = 0; i < BOARD_SLOTS; i++) {
                    if (animatingRef.current.has(i)) continue;
                    next[i] = i < cardCount;
                }
                return next;
            });
            return;
        }

        // A street was dealt. The new cards occupy the top slots; everything below
        // them belongs to earlier streets and stays revealed.
        const newCardCount = dealHint.cards?.length ?? 0;
        const startSlot = Math.max(0, cardCount - newCardCount);
        const stagger = dealHint.staggerMs ?? 0;

        clearTimers();
        animatingRef.current = new Set();
        for (let slot = startSlot; slot < cardCount; slot++) {
            animatingRef.current.add(slot);
        }

        // Prior-street slots stay revealed; this street's new slots start hidden.
        setRevealedSlots(() => {
            const next = allHidden();
            for (let i = 0; i < startSlot; i++) next[i] = true;
            return next;
        });

        // Reveal (drop in) the newly-dealt slots one at a time.
        for (let slot = startSlot; slot < cardCount; slot++) {
            const delay = stagger * (slot - startSlot + 1);
            timersRef.current.push(
                setTimeout(() => {
                    animatingRef.current.delete(slot);
                    setRevealedSlots(prev => {
                        const next = [...prev];
                        next[slot] = true;
                        return next;
                    });
                }, delay)
            );
        }

        // Ack the bus when the last card has finished dropping in (Phase 5): the
        // drain then holds the next commit for exactly how long the reveal took,
        // not a fixed guess. The last slot is revealed at stagger × newCardCount;
        // the drop finishes CARD_DROP_MS after that. If this component unmounts
        // first the timer is cleared and the bus's ackTimeoutMs takes over.
        if (dealHint.ackId) {
            const ackId = dealHint.ackId;
            const doneAt = stagger * newCardCount + CARD_DROP_MS;
            timersRef.current.push(setTimeout(() => ackDone(ackId), doneAt));
        }
    }, [latestItem, cardCount, ackDone]);

    // Cleanup on unmount.
    useEffect(() => () => clearTimers(), []);

    return {
        revealedSlots,
        showThreeCards: cardCount >= 3
    };
};
