import React from "react";
import { Modal } from "../common";
import { escrowStatement, formatUsdc, type TournamentLobbyCard } from "../../utils/tournamentLobby";
import { isNullish } from "../../utils/guards";

interface TournamentRegisterModalProps {
    card: TournamentLobbyCard | null;
    mode: "register" | "unregister";
    busy: boolean;
    error: string | null;
    /** The player's USDC balance in micro-units; undefined while unknown (no check is made). */
    balanceMicro?: bigint;
    onConfirm: () => void;
    onClose: () => void;
}

/** Confirms a registration or an unregistration and says exactly where the buy-in goes (no promise of a full refund). */
export const TournamentRegisterModal: React.FC<TournamentRegisterModalProps> = ({ card, mode, busy, error, balanceMicro, onConfirm, onClose }) => {
    if (!card) return null;
    const statement = escrowStatement(card.cost);
    const registering = mode === "register";
    // The chain needs buy-in + network fee; say so before the player signs.
    const shortOfTotal = registering && !isNullish(balanceMicro) && balanceMicro < card.cost.total;
    return (
        <Modal
            isOpen
            onClose={onClose}
            title={registering ? "Register for tournament" : "Unregister from tournament"}
            error={error}
            isProcessing={busy}
            widthClass="w-[28rem]"
            patternId="hexagons-tournament-register"
        >
            <div className="text-sm text-gray-200 space-y-3" data-testid="tournament-escrow-statement">
                <div className="flex justify-between">
                    <span className="text-gray-400">{registering ? "Buy-in" : "Buy-in paid"}</span>
                    <span className="text-white font-medium">{formatUsdc(card.cost.gross)}</span>
                </div>
                {card.cost.entryFee > 0n && (
                    <div className="flex justify-between">
                        <span className="text-gray-400">Entry fee (to the creator, inside the buy-in)</span>
                        <span>{formatUsdc(card.cost.entryFee)}</span>
                    </div>
                )}
                {card.cost.protocolCut > 0n && (
                    <div className="flex justify-between">
                        <span className="text-gray-400">Network fee (inside the buy-in)</span>
                        <span>{formatUsdc(card.cost.protocolCut)}</span>
                    </div>
                )}
                {card.cost.networkFee > 0n && (
                    <div className="flex justify-between" data-testid="tournament-network-fee">
                        <span className="text-gray-400">Network fee (on top of the buy-in)</span>
                        <span>+ {formatUsdc(card.cost.networkFee)}</span>
                    </div>
                )}
                {registering && card.cost.networkFee > 0n && (
                    <div className="flex justify-between border-t border-white/10 pt-2">
                        <span className="text-gray-300 font-medium">Total you pay</span>
                        <span className="text-white font-medium">{formatUsdc(card.cost.total)}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-gray-400">{registering ? "Held in escrow for the prize pool" : "Returned to you"}</span>
                    <span>{formatUsdc(card.cost.net)}</span>
                </div>
                <p className="text-xs text-gray-400">{registering ? statement.register : statement.unregister}</p>
                {shortOfTotal && (
                    <p className="text-sm text-red-400" role="alert" data-testid="tournament-insufficient-balance">
                        Your balance is {formatUsdc(balanceMicro)}. You need {formatUsdc(card.cost.total)} to register (buy-in plus fees). Deposit to continue.
                    </p>
                )}
                {registering && (
                    <p className="text-xs text-gray-400">
                        You can unregister until the tournament starts. If fewer than {card.minEntrants} players have registered by then, it is cancelled and only the {formatUsdc(card.cost.net)} held in escrow is returned.
                    </p>
                )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
                    data-testid="tournament-modal-cancel"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={busy || shortOfTotal}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white disabled:opacity-50"
                    data-testid="tournament-modal-confirm"
                >
                    {busy ? "Waiting for the chain…" : registering ? `Pay ${formatUsdc(card.cost.total)} and register` : "Unregister"}
                </button>
            </div>
        </Modal>
    );
};
