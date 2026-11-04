import { PlayerStatus, type PlayerDTO } from "@block52/poker-vm-sdk";

/**
 * Whether a player's hand is tabled (face up for everyone): their status is
 * SHOWING, or the engine marked it shown at this hand's showdown
 * (`cardsShown`, poker-vm#2758). The mark covers a player who busted or sat
 * out on the hand they showed down: their status leaves SHOWING after the
 * payout, but every hand that reaches the showdown is tabled (all-ins face
 * up, TDA Rule 16), in cash, sit-and-go and tournament alike.
 */
export const isTabledHand = (player: Pick<PlayerDTO, "status" | "cardsShown"> | null | undefined): boolean =>
    player?.status === PlayerStatus.SHOWING || player?.cardsShown === true;
