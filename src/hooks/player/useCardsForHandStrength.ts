import { useMemo } from "react";
import { usePlayerData } from "./usePlayerData";
import { useTableData } from "../game/useTableData";
import { PokerSolver, PokerGameIntegration, Deck } from "@block52/poker-vm-sdk";

export interface HandStrength {
  name: string;
  descr: string; // Obsolete, use description instead.  Was used in the old lib
  description: string;
  score: number;
  hand: string[]; // Your cards that make up the hand
}

export const useCardsForHandStrength = (seatIndex?: number): HandStrength | null => {
  const { holeCards } = usePlayerData(seatIndex);
  const { tableDataCommunityCards } = useTableData();

  // Key the evaluation on the CARDS, not on the arrays holding them. Both inputs
  // are rebuilt from a fresh `gameState` on every WS frame -- `holeCards` is
  // memoized on `playerData`, itself a new PlayerDTO per snapshot, and
  // `tableDataCommunityCards` is `gameState.communityCards` -- so keying on
  // identity re-ran Deck.fromString x7 plus a full hand evaluation several times
  // a second, on a component that is always mounted. The cards themselves only
  // change when a street is dealt.
  const holeKey = holeCards?.join(",") ?? "";
  const boardKey = tableDataCommunityCards?.join(",") ?? "";

  // holeCards/tableDataCommunityCards are deliberately not dependencies: the two
  // keys above encode their contents completely.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    // Need at least hole cards to evaluate
    if (!holeCards || holeCards.length < 2) {
      return null;
    }

    // Combine hole cards and community cards
    const allCards = [...holeCards, ...tableDataCommunityCards];

    try {
      // Convert string cards to Card objects
      const cardObjects = allCards.map(cardStr => Deck.fromString(cardStr));

      // Use evaluatePartialHand which handles 2-7 cards (preflop through river)
      const evaluation = PokerSolver.evaluatePartialHand(cardObjects);

      // For preflop (2 cards), use the description directly from evaluatePartialHand
      // For flop/turn/river (5-7 cards), use formatHandDescription for detailed output
      const description = allCards.length === 2
        ? evaluation.description
        : PokerGameIntegration.formatHandDescription(evaluation);

      return {
        name: description,
        descr: description,
        description: description,
        score: evaluation.handType,
        hand: evaluation.bestHand.map(card => card.mnemonic || card.toString()),
      };
    } catch (error) {
      console.error("Error calculating hand strength:", error);
      return null;
    }
  }, [holeKey, boardKey]);
};
