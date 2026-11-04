import { useMemo } from "react";
import { useGameStateContext } from "../../context/GameStateContext";
import { PlayerDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { ShowingCardsByAddressReturn, ShowingCardData } from "../../types/index";
import { isRevealedHand } from "../../bus/deriveEvents";
import { isTabledHand } from "../../utils/tabledHand";

/**
 * Custom hook to get hole cards of players who have shown their cards
 * 
 * NOTE: Player showing status and hole cards are handled through GameStateContext subscription.
 * Components call subscribeToTable(tableId) which creates a WebSocket connection with both tableAddress 
 * and playerId parameters. This hook reads the real-time showing cards data from that context.
 * 
 * @returns Object containing all players whose hand is tabled and their cards
 */
export const useShowingCardsByAddress = (): ShowingCardsByAddressReturn => {
  // Get game state directly from Context - real-time data via WebSocket
  const { gameState, isLoading, error, isReplayMode } = useGameStateContext();
  
  // Check if round is showdown or end
  const isShowdown = useMemo((): boolean => {
    if (!gameState?.round) return false;
    return gameState.round === TexasHoldemRound.SHOWDOWN || gameState.round === TexasHoldemRound.END;
  }, [gameState?.round]);

  const showingFingerprint = useMemo(() => (
    gameState?.players ?? []
  ).map(player => `${player.seat}:${player.status}:${player.cardsShown === true}:${player.holeCards?.join(",") ?? ""}`).join("|"), [gameState?.players]);
  
  // Find all players with status "showing"
  const showingPlayers = useMemo((): ShowingCardData[] => {
    if (!gameState?.players) return [];
    
    try {
      return gameState.players
        .filter((player: PlayerDTO) => 
          // Any count of real cards: two for Hold'em, four for Omaha (ui#768).
          // In a replay the only real cards in state are ones the viewer is
          // entitled to see (shown at showdown, or their own — ui#816), on
          // every step of the hand, whatever the player's status was then.
          // A player who busted on a showdown keeps their hand tabled through
          // cardsShown after their status leaves SHOWING (poker-vm#2758).
          (isTabledHand(player) || isReplayMode) && isRevealedHand(player.holeCards)
        )
        .map((player: PlayerDTO) => ({
          address: player.address,
          holeCards: player.holeCards || [],
          seat: player.seat
        }));
    } catch (err) {
      console.error("Error filtering showing players:", err);
      return [];
    }
  }, [showingFingerprint, isReplayMode]);

  const showingBySeat = useMemo(() => {
    const bySeat = new Map<number, ShowingCardData>();
    for (const player of showingPlayers) {
      bySeat.set(player.seat, player);
    }
    return bySeat;
  }, [showingPlayers]);
  
  return {
    showingPlayers,
    showingBySeat,
    isShowdown,
    isLoading,
    error
  };
};
