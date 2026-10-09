/**
 * SitAndGoResultModal
 *
 * One-shot modal shown to the current user once they've finished a
 * Sit-and-Go tournament. Surfaces the place + payout (or a "thanks
 * for playing" message for unpaid finishes), with a "Spectate Table"
 * CTA that fires the chain leave so the table can be reaped.
 *
 * Triggering logic lives inside this component (rather than the
 * parent), so the parent only needs to mount it for SNG tables and
 * pass `tableId` + `onLeave`. The modal:
 *   - reads the current user's result via useSitAndGoPlayerResults;
 *   - returns null if there's no result yet (player still active);
 *   - returns null if the user has already dismissed it this game
 *     (localStorage flag keyed on `${tableId}:${userAddress}`).
 */
import React, { useEffect, useMemo, useState } from "react";
import { truncateMiddle } from "../../utils/stringUtils";
import { useSitAndGoPlayerResults } from "../../hooks/game/useSitAndGoPlayerResults";
import { useFetchSngClaimSignature } from "../../hooks/game/useFetchSngClaimSignature";
import { useClaimSngWinNFT } from "../../hooks/wallet/useClaimSngWinNFT";
import useUserWalletConnect from "../../hooks/wallet/useUserWalletConnect";
import { formatUSDCToSimpleDollars } from "../../utils/numberUtils";
import { isNullish } from "../../utils/guards";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { Modal } from "../common/Modal";
import { ModalFooter } from "./ModalFooter";
import { PillButton } from "../ui/PillButton";
import { fieldLabelClass, insetBoxClass, noticeClass } from "./walletFormClasses";

type ClaimState =
    | { kind: "idle" }
    | { kind: "fetching" }    // fetching the validator signature from the chain
    | { kind: "submitting" }  // user has signed in MetaMask; waiting for chain receipt
    | { kind: "done" }
    | { kind: "error"; message: string };

const PLACE_SUFFIX = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
// The result modal is not dismissable by backdrop/Escape; this satisfies Modal's required onClose.
const noop = (): void => undefined;

const ordinal = (place: number): string => PLACE_SUFFIX[place - 1] ?? `${place}th`;

// localStorage flag — once the user has dismissed the modal for this
// (tableId, userAddress), a page refresh shouldn't re-pop it.
const dismissKey = (tableId: string, userAddress: string) =>
    `viewed_sng_result_${tableId}_${userAddress.toLowerCase()}`;

interface SitAndGoResultModalProps {
    tableId: string | undefined;
    /**
     * Invoked when the user clicks "Spectate Table". Should fire the
     * chain leave action so the finished table can be reaped.
     */
    onLeave: () => void | Promise<void>;
    /**
     * Invoked when a paid finisher clicks "Claim winnings". Fires the SNG prize
     * claim (record hand-end state + settle via MsgLeaveGame). Distinct from
     * onLeave: post-start the roster is frozen — finishers claim, they don't
     * leave.
     */
    onClaim: () => Promise<void>;
}

export const SitAndGoResultModal: React.FC<SitAndGoResultModalProps> = ({ tableId, onLeave, onClaim }) => {
    const { isSitAndGo, getPlayerResult } = useSitAndGoPlayerResults();

    // Read the user address fresh on mount only. The active wallet
    // never changes mid-session for a given table view.
    const userAddress = useMemo(
        () => localStorage.getItem(STORAGE_KEYS.cosmosAddress)?.toLowerCase() ?? null,
        [],
    );

    const playerResult = useMemo(() => {
        if (!isSitAndGo || isNullish(userAddress)) return null;
        return getPlayerResult(userAddress);
    }, [isSitAndGo, getPlayerResult, userAddress]);

    // Seed dismissed state from localStorage so a page refresh after
    // the user explicitly closed the modal doesn't re-pop it.
    const [dismissed, setDismissed] = useState<boolean>(() => {
        if (isNullish(tableId) || isNullish(userAddress)) return false;
        return localStorage.getItem(dismissKey(tableId, userAddress)) === "true";
    });

    // If the user lands on the page and the result is already present
    // (e.g. tournament ended while they were away), the seeded state
    // above already gates correctly. This effect only matters for the
    // mid-session transition (result arrives via WS push while modal
    // is mounted).
    useEffect(() => {
        if (isNullish(tableId) || isNullish(userAddress)) return;
        setDismissed(localStorage.getItem(dismissKey(tableId, userAddress)) === "true");
    }, [tableId, userAddress]);

    // Gated on the chain signature endpoint and the contract address; the button surfaces the hook's structured error if either is missing.
    const { fetchSignature } = useFetchSngClaimSignature();
    const { claim, isClaimConfirmed, claimError, hash: claimHash } = useClaimSngWinNFT();
    const { address: web3Address, isConnected: isWeb3Connected, open: openWalletConnect } = useUserWalletConnect();
    const [claimState, setClaimState] = useState<ClaimState>({ kind: "idle" });
    // USDC prize claim (record hand-end + settle), distinct from the NFT claim.
    const [prizeClaim, setPrizeClaim] = useState<{ kind: "idle" | "claiming" | "done" | "error"; message?: string }>({ kind: "idle" });

    // Flip to "done" once wagmi's useWaitForTransactionReceipt fires.
    useEffect(() => {
        if (isClaimConfirmed && claimState.kind === "submitting") {
            setClaimState({ kind: "done" });
        }
    }, [isClaimConfirmed, claimState.kind]);

    // Wagmi-level error (e.g. user rejected in MetaMask, RPC failed).
    useEffect(() => {
        if (claimError && claimState.kind === "submitting") {
            setClaimState({
                kind: "error",
                message: claimError.message || "MetaMask transaction failed",
            });
        }
    }, [claimError, claimState.kind]);

    if (isNullish(playerResult) || dismissed) return null;
    if (isNullish(tableId) || isNullish(userAddress)) return null;

    const { place, payout, isWinner } = playerResult;
    const isPaid = payout !== "0";

    const handleLeaveClick = async () => {
        // Persist dismissal first so a slow chain leave doesn't leave
        // the modal hanging if the user navigates away mid-tx.
        localStorage.setItem(dismissKey(tableId, userAddress), "true");
        setDismissed(true);
        await onLeave();
    };

    // Dismiss only — closes the modal without firing the chain leave. Used after
    // a paid finisher has claimed (post-start the roster is frozen; they claim,
    // they don't leave).
    const handleDismiss = () => {
        localStorage.setItem(dismissKey(tableId, userAddress), "true");
        setDismissed(true);
    };

    const handleClaimWinningsClick = async () => {
        try {
            setPrizeClaim({ kind: "claiming" });
            await onClaim();
            setPrizeClaim({ kind: "done" });
        } catch (e) {
            setPrizeClaim({ kind: "error", message: e instanceof Error ? e.message : "Claim failed" });
        }
    };

    const handleClaimClick = async () => {
        if (!isWeb3Connected || !web3Address) {
            // Nudge the user to connect MetaMask first.
            openWalletConnect();
            return;
        }
        try {
            setClaimState({ kind: "fetching" });
            const payload = await fetchSignature(tableId, userAddress);
            setClaimState({ kind: "submitting" });
            await claim(payload);
        } catch (e) {
            const message =
                e instanceof Error ? e.message : "Failed to claim NFT";
            setClaimState({ kind: "error", message });
        }
    };

    // Copy: paid finishers get the celebratory variant (with payout
    // line). Unpaid finishers get a softer message with no dollar
    // amount. Winners get a small celebratory swap.
    const heading = isWinner
        ? "You won the tournament!"
        : isPaid
            ? `You finished ${ordinal(place)}!`
            : `You busted out — finished ${ordinal(place)}.`;

    const subtext = isPaid
        ? null
        : "Thanks for playing.";

    return (
        <div data-testid="sng-result-modal">
            <Modal
                isOpen
                onClose={noop}
                closeOnEscape={false}
                closeOnBackdropClick={false}
                widthClass="w-[420px]"
                ariaLabel="Sit & Go result"
            >
                <div className="flex flex-col items-center text-center">
                    <div
                        className={`min-w-20 h-20 px-5 rounded-full grid place-items-center text-3xl font-bold tabular-nums border ${
                            isWinner
                                ? "bg-brand/15 border-brand/40 text-brand-light"
                                : "bg-surface-raised border-line-strong text-ink-soft"
                        }`}
                        aria-label={`Finished ${ordinal(place)}`}
                    >
                        {ordinal(place)}
                    </div>

                    <h2 className="m-0 mt-4 text-xl font-semibold text-ink" data-testid="sng-result-heading">
                        {heading}
                    </h2>

                    {subtext && <p className="m-0 mt-1 text-ink-muted text-sm">{subtext}</p>}
                </div>

                {isPaid && (
                    <div className={`${insetBoxClass} mt-5 text-center`}>
                        <div className={fieldLabelClass.replace("block mb-2", "block mb-1")}>Your payout</div>
                        <div className="text-3xl text-emerald-400 font-bold tabular-nums" data-testid="sng-result-payout">
                            ${formatUSDCToSimpleDollars(payout)}
                        </div>
                    </div>
                )}

                {prizeClaim.kind === "error" && (
                    <p className={`m-0 mt-3 ${noticeClass.error}`} data-testid="sng-result-prize-claim-error" role="alert">
                        {prizeClaim.message}
                    </p>
                )}

                {claimState.kind === "error" && (
                    <p className={`m-0 mt-3 ${noticeClass.error}`} data-testid="sng-result-claim-error" role="alert">
                        {claimState.message}
                    </p>
                )}

                {claimState.kind === "done" && claimHash && (
                    <p className={`m-0 mt-3 ${noticeClass.success}`}>
                        Tx:{" "}
                        <a
                            href={`https://etherscan.io/tx/${claimHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline font-mono hover:text-emerald-300"
                        >
                            {truncateMiddle(claimHash, 10, 8, "…")}
                        </a>
                    </p>
                )}

                <ModalFooter>
                    {isPaid && (
                        <PillButton
                            onClick={prizeClaim.kind === "done" ? handleDismiss : handleClaimWinningsClick}
                            disabled={prizeClaim.kind === "claiming"}
                            data-testid="sng-result-claim-winnings-btn"
                            size="lg"
                            className="w-full"
                        >
                            {prizeClaim.kind === "claiming" && "Collecting…"}
                            {prizeClaim.kind === "done" && (
                                <>
                                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M4 10.5l4 4 8-9" />
                                    </svg>
                                    Paid!
                                </>
                            )}
                            {(prizeClaim.kind === "idle" || prizeClaim.kind === "error") && `Collect $${formatUSDCToSimpleDollars(payout)}`}
                        </PillButton>
                    )}

                    {isPaid && (
                        <PillButton
                            variant="outline"
                            onClick={handleClaimClick}
                            disabled={
                                claimState.kind === "fetching" ||
                                claimState.kind === "submitting" ||
                                claimState.kind === "done"
                            }
                            data-testid="sng-result-claim-btn"
                            className="w-full"
                        >
                            {claimState.kind === "fetching" && "Requesting signature…"}
                            {claimState.kind === "submitting" && "Confirm in MetaMask…"}
                            {claimState.kind === "done" && "NFT Claimed"}
                            {(claimState.kind === "idle" || claimState.kind === "error") && "Claim NFT"}
                        </PillButton>
                    )}

                    {/* Paid finishers claim (above) and dismiss via the Paid! button —
                        no Leave. Unpaid finishers have no prize, so keep a dismiss. */}
                    {!isPaid && (
                        <PillButton onClick={handleLeaveClick} data-testid="sng-result-leave-btn" size="lg" className="w-full">
                            Spectate Table
                        </PillButton>
                    )}
                </ModalFooter>
            </Modal>
        </div>
    );
};

export default SitAndGoResultModal;
