import { useCallback } from "react";
import { useNetwork } from "../../context/NetworkContext";

/**
 * Validator-signed payload returned by the chain for a SitAndGo win
 * NFT claim. Mirrors the call-shape of {@link SngWinNFT.claim} —
 * the UI passes these straight to the contract along with the
 * signature.
 */
export interface SngClaimPayload {
    recipient: `0x${string}`; // EVM address the NFT mints to
    gameId: `0x${string}`;    // 0x-prefixed bytes32 — pokerchain game ID
    place: number;             // uint8
    payout: string;            // USDC microunits, BigInt-as-string
    timestamp: number;         // uint64 seconds
    format: `0x${string}`;     // keccak256("sit-and-go") etc.
    signature: `0x${string}`;  // 65-byte validator signature, 0x-prefixed
}

/**
 * Fetches a validator-signed claim payload for the current user's
 * SNG win. Powers the "Claim NFT" button on {@link SitAndGoResultModal}.
 *
 * **Backend endpoint not yet live.** This hook is shipped alongside
 * the UI for [block52/poker-vm#2119] piece 3; the chain-side query
 * endpoint (piece 2) is the next deliverable from that issue.
 * Once piece 2 lands, this hook hits
 *   GET /poker/v1/sng_claim_signature?gameId=…&address=…
 * and returns the parsed payload. Until then the hook throws a
 * structured error that the modal renders as "Feature coming soon".
 */
export const useFetchSngClaimSignature = () => {
    const { currentNetwork } = useNetwork();

    const fetchSignature = useCallback(
        async (gameId: string, address: string): Promise<SngClaimPayload> => {
            // TODO(block52/poker-vm#2119, piece 2): swap this stub for
            // a real GET against
            //   `${currentNetwork.rest}/block52/pokerchain/poker/v1/sng_claim_signature`
            // with query params { gameId, address }. The chain handler
            // verifies the user finished paid + signs with the
            // validator_eth_private_key, returning the payload above.
            //
            // For now we surface a clear "not yet available" error so
            // the UI shows a sensible message instead of dispatching
            // a zero-address tx.
            void currentNetwork;
            void gameId;
            void address;
            throw new Error(
                "SNG win-NFT claim endpoint not yet deployed on the chain " +
                "(tracked in block52/poker-vm#2119 piece 2). Check back once it ships.",
            );
        },
        [currentNetwork],
    );

    return { fetchSignature };
};
