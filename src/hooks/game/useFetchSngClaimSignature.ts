import { useCallback } from "react";
import { useNetwork } from "../../context/NetworkContext";
import { getCosmosUrls } from "../../utils/cosmos/urls";

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
 * Shape returned by the chain's REST gateway. snake_case + payload
 * fields as strings/numbers. Translated to {@link SngClaimPayload}
 * (0x-typed branded strings) before handing off to the contract.
 */
interface ChainResponse {
    recipient: string;
    game_id: string;
    place: number;
    payout: string;
    timestamp: string;  // gateway encodes uint64 as a JSON string
    format: string;
    signature: string;
}

/**
 * Fetches a validator-signed claim payload for the current user's
 * SNG win. Powers the "Claim NFT" button on {@link SitAndGoResultModal}.
 *
 * Hits the chain query landed in
 *   GET /block52/pokerchain/poker/v1/sng_claim_signature/{game_id}/{cosmos_address}
 *
 * (See block52/pokerchain#202.) The chain returns 4xx-ish errors as
 * JSON `{ code, message }`; we surface message as the thrown Error
 * so the modal's existing error-line treatment shows something
 * useful instead of a raw `fetch failed`.
 */
export const useFetchSngClaimSignature = () => {
    const { currentNetwork } = useNetwork();

    const fetchSignature = useCallback(
        async (gameId: string, address: string): Promise<SngClaimPayload> => {
            const { restEndpoint } = getCosmosUrls(currentNetwork);
            const url = `${restEndpoint}/block52/pokerchain/poker/v1/sng_claim_signature/${encodeURIComponent(gameId)}/${encodeURIComponent(address)}`;

            const response = await fetch(url);
            const raw = await response.json().catch(() => ({}));

            if (!response.ok) {
                // Cosmos REST gateway error shape: { code, message, details }
                const msg = typeof raw?.message === "string" ? raw.message : response.statusText;
                throw new Error(`Failed to fetch SNG claim signature: ${msg}`);
            }

            const data = raw as ChainResponse;
            if (!data.signature || !data.recipient) {
                throw new Error("Chain returned an empty SNG claim signature payload");
            }

            return {
                recipient: data.recipient as `0x${string}`,
                gameId: data.game_id as `0x${string}`,
                place: data.place,
                payout: data.payout,
                timestamp: Number(data.timestamp),
                format: data.format as `0x${string}`,
                signature: data.signature as `0x${string}`,
            };
        },
        [currentNetwork],
    );

    return { fetchSignature };
};
