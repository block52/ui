/**
 * Minimal ABI for SngWinNFT.claim() — only the parts the UI needs.
 *
 * Contract: block52/poker-vm contracts/contracts/SngWinNFT.sol
 * Issue: block52/poker-vm#2119
 *
 * Full ABI lives in poker-vm's typechain-types after compile. We
 * intentionally keep just the function signature the UI invokes
 * (plus the Claimed event for receipt parsing) so this file stays
 * a one-glance reference rather than a 1k-line JSON dump.
 */
export const sngWinNftABI = [
    {
        type: "function",
        name: "claim",
        stateMutability: "nonpayable",
        inputs: [
            { name: "recipient", type: "address" },
            { name: "gameId", type: "bytes32" },
            { name: "place", type: "uint8" },
            { name: "payout", type: "uint256" },
            { name: "timestamp", type: "uint64" },
            { name: "format", type: "bytes32" },
            { name: "signature", type: "bytes" }
        ],
        outputs: [{ name: "tokenId", type: "uint256" }]
    },
    {
        type: "event",
        name: "Claimed",
        inputs: [
            { name: "recipient", type: "address", indexed: true },
            { name: "tokenId", type: "uint256", indexed: true },
            { name: "gameId", type: "bytes32", indexed: true },
            { name: "place", type: "uint8", indexed: false },
            { name: "payout", type: "uint256", indexed: false },
            { name: "timestamp", type: "uint64", indexed: false }
        ],
        anonymous: false
    }
] as const;
