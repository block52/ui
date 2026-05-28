import { useCallback, useEffect, useMemo } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { sngWinNftABI } from "../../abis/sngWinNftABI";
import { SNG_WIN_NFT_ADDRESS } from "../../config/constants";
import useUserWalletConnect from "./useUserWalletConnect";
import type { SngClaimPayload } from "../game/useFetchSngClaimSignature";

/**
 * Mirrors {@link useWithdraw} for the SNG win-NFT claim flow.
 *
 * The chain emits a validator-signed payload; this hook hands the
 * payload + signature to wagmi's `useWriteContract` to fire the
 * `SngWinNFT.claim()` call from MetaMask, then exposes the tx-hash
 * + confirmation state via `useWaitForTransactionReceipt`.
 *
 * The contract address (`SNG_WIN_NFT_ADDRESS`) is `0x0...` until
 * the contract is deployed — see [block52/poker-vm#2119]. The hook
 * surfaces a clear error in that case rather than firing a tx to
 * the zero address.
 */
export const useClaimSngWinNFT = () => {
    const NFT_ADDRESS = SNG_WIN_NFT_ADDRESS;
    const { data: hash, isPending, mutate, error } = useWriteContract();
    const { address: userAddress } = useUserWalletConnect();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

    useEffect(() => {
        if (error) {
            console.error("[useClaimSngWinNFT] Transaction error:", error);
        }
    }, [error]);

    const claim = useCallback(
        async (payload: SngClaimPayload): Promise<void> => {
            if (!userAddress) {
                throw new Error("Web3 wallet is not connected");
            }
            if (NFT_ADDRESS === "0x0000000000000000000000000000000000000000") {
                throw new Error(
                    "SngWinNFT contract not yet deployed. Tracked in " +
                    "block52/poker-vm#2119. Coming soon.",
                );
            }

            mutate({
                address: NFT_ADDRESS as `0x${string}`,
                abi: sngWinNftABI,
                functionName: "claim",
                args: [
                    payload.recipient,
                    payload.gameId,
                    payload.place,
                    BigInt(payload.payout),
                    BigInt(payload.timestamp),
                    payload.format,
                    payload.signature,
                ],
            });
        },
        [userAddress, mutate, NFT_ADDRESS],
    );

    return useMemo(
        () => ({
            claim,
            hash,
            isClaimPending: isPending || isConfirming,
            isClaimConfirmed: isConfirmed,
            claimError: error,
        }),
        [claim, hash, isPending, isConfirming, isConfirmed, error],
    );
};

export default useClaimSngWinNFT;
