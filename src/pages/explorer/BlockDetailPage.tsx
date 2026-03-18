import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getCosmosClient } from "../../utils/cosmos/client";
import { useNetwork } from "../../context/NetworkContext";
import { ClickableAddress } from "../../components/explorer/ClickableAddress";
import { AnimatedBackground } from "../../components/common/AnimatedBackground";
import { formatProposerAddress } from "../../utils/formatUtils";
import styles from "./BlockDetailPage.module.css";
// Define block response type locally to match Cosmos API response
interface CosmosBlockResponse {
    block_id: {
        hash: string;
        parts: {
            total: number;
            hash: string;
        };
    };
    block: {
        header: {
            version: { block: string; app: string };
            chain_id: string;
            height: string;
            time: string;
            last_block_id: { hash: string; parts: { total: number; hash: string } };
            last_commit_hash: string;
            data_hash: string;
            validators_hash: string;
            next_validators_hash: string;
            consensus_hash: string;
            app_hash: string;
            last_results_hash: string;
            evidence_hash: string;
            proposer_address: string;
        };
        data: {
            txs: string[];
        };
        evidence: {
            evidence: unknown[];
        };
        last_commit: {
            height: string;
            round: number;
            block_id: { hash: string; parts: { total: number; hash: string } };
            signatures: Array<{
                block_id_flag: number;
                validator_address: string;
                timestamp: string;
                signature: string;
            }>;
        };
    };
    sdk_block?: {
        header: {
            version: { block: string; app: string };
            chain_id: string;
            height: string;
            time: string;
            proposer_address: string;
        };
        data: {
            txs: string[];
        };
    };
}

type CosmosBlock = CosmosBlockResponse;

export default function BlockDetailPage() {
    const { height } = useParams<{ height: string }>();
    const navigate = useNavigate();
    const { currentNetwork } = useNetwork();
    const [block, setBlock] = useState<CosmosBlock | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedTxs, setExpandedTxs] = useState<Set<number>>(new Set());
    const [txHashes, setTxHashes] = useState<string[]>([]);

    useEffect(() => {
        // Set page title
        document.title = `Block #${height} - Block52 Explorer`;

        const fetchBlock = async () => {
            try {
                if (!height) {
                    throw new Error("No height provided");
                }

                const cosmosClient = getCosmosClient(currentNetwork);

                if (!cosmosClient) {
                    throw new Error("Block52 client not initialized. Please check your wallet connection.");
                }

                const blockData = await cosmosClient.getBlock(parseInt(height));
                setBlock(blockData as unknown as CosmosBlock);
                setError(null);
            } catch (err: any) {
                setError(err.message || "Failed to fetch block");
                console.error("Error fetching block:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchBlock();

        // Cleanup: reset title when component unmounts
        return () => {
            document.title = "Block52 Chain";
        };
    }, [height, currentNetwork]);

    // Compute transaction hashes after block is loaded
    useEffect(() => {
        if (!block) return;

        const computeHashes = async () => {
            const hashes = await Promise.all(
                block.block.data.txs.map(async (tx: string) => {
                    const hexTx = decodeTransaction(tx);
                    return await calculateTxHash(hexTx);
                })
            );
            setTxHashes(hashes);
        };

        computeHashes();
    }, [block]);

    const truncateHash = (hash: string, length: number = 16) => {
        if (!hash) return "N/A";
        if (hash.length <= length * 2) return hash;
        return `${hash.slice(0, length)}...${hash.slice(-length)}`;
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            alert("Copied to clipboard!");
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const toggleRawData = (txIndex: number) => {
        setExpandedTxs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(txIndex)) {
                newSet.delete(txIndex);
            } else {
                newSet.add(txIndex);
            }
            return newSet;
        });
    };

    const decodeTransaction = (base64Tx: string) => {
        try {
            // Decode base64 to hex for display
            const decoded = atob(base64Tx);
            let hex = "";
            for (let i = 0; i < decoded.length; i++) {
                const hexByte = decoded.charCodeAt(i).toString(16).padStart(2, "0");
                hex += hexByte;
            }
            return hex;
        } catch (err) {
            console.error("Failed to decode transaction:", err);
            return base64Tx;
        }
    };

    // Calculate transaction hash (SHA256 of transaction bytes)
    const calculateTxHash = async (hexTx: string): Promise<string> => {
        try {
            // Convert hex string to Uint8Array
            const bytes = new Uint8Array(hexTx.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);

            // Calculate SHA256 hash
            const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);

            // Convert to uppercase hex string
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray
                .map(b => b.toString(16).padStart(2, "0"))
                .join("")
                .toUpperCase();

            return hashHex;
        } catch (err) {
            console.error("Failed to calculate tx hash:", err);
            return "";
        }
    };

    // Extract message type from transaction hex
    const extractMessageType = (hexTx: string): string => {
        try {
            // Look for common Cosmos message type URLs in the hex
            const messageTypes: { [key: string]: string } = {
                "2f636f736d6f732e62616e6b2e763162657461312e4d736753656e64": "Bank Send (Transfer)",
                "2f706f6b6572636861696e2e706f6b65722e76312e4d736743726561746547616d65": "Create Game",
                "2f706f6b6572636861696e2e706f6b65722e76312e4d73674a6f696e47616d65": "Join Game",
                "2f706f6b6572636861696e2e706f6b65722e76312e4d7367506572666f726d416374696f6e": "Perform Action",
                "2f706f6b6572636861696e2e706f6b65722e76312e4d73674c6561766547616d65": "Leave Game",
                "2f636f736d6f732e7374616b696e672e763162657461312e4d736744656c6567617465": "Delegate",
                "2f636f736d6f732e646973747269627574696f6e2e763162657461312e4d7367576974686472617744656c656761746f72526577617264": "Withdraw Rewards"
            };

            for (const [pattern, type] of Object.entries(messageTypes)) {
                if (hexTx.includes(pattern)) {
                    return type;
                }
            }

            return "Unknown Message Type";
        } catch (err) {
            return "Unknown";
        }
    };

    // Extract addresses from transaction hex (simplified)
    const extractTransactionDetails = (hexTx: string) => {
        try {
            const details: { type: string; from?: string; to?: string; amount?: string; denom?: string; gameId?: string; gameType?: string } = {
                type: extractMessageType(hexTx)
            };

            // Look for b52 addresses (they start with specific hex patterns)
            // This is a simplified extraction - full protobuf decoding would be better
            const decoded = hexTx.match(/62353231[a-f0-9]+/g);
            if (decoded && decoded.length >= 2) {
                // Convert hex to ASCII to get b52 addresses
                const fromAddr =
                    decoded[0]
                        .match(/.{1,2}/g)
                        ?.map(byte => String.fromCharCode(parseInt(byte, 16)))
                        .join("") || "";
                const toAddr =
                    decoded[1]
                        .match(/.{1,2}/g)
                        ?.map(byte => String.fromCharCode(parseInt(byte, 16)))
                        .join("") || "";

                if (fromAddr.startsWith("b521")) details.from = fromAddr;
                if (toAddr.startsWith("b521")) details.to = toAddr;
            }

            // Try to extract amount and denom
            // Pattern: 0a08(denom)12(length)(amount)
            // Example: 0a08623532546f6b656e1208313030303030303030
            //          0a08 = field + length for denom
            //          623532546f6b656e = "b52Token"
            //          12 = field number for amount
            //          08 = length of amount (8 bytes)
            //          313030303030303030 = "10000000"
            const tokenPattern = hexTx.match(/0a08623532546f6b656e12([0-9a-f]{2})([0-9a-f]+)/);
            if (tokenPattern) {
                const lengthByte = parseInt(tokenPattern[1], 16); // Length in bytes
                const amountHex = tokenPattern[2].substring(0, lengthByte * 2); // Extract exact length

                // Convert hex amount to ASCII
                const amount =
                    amountHex
                        .match(/.{1,2}/g)
                        ?.map(byte => String.fromCharCode(parseInt(byte, 16)))
                        .join("") || "";
                details.amount = amount;
                details.denom = "b52Token";
            }

            // Also try to match usdc pattern
            const usdcPattern = hexTx.match(/0a05757573646312([0-9a-f]{2})([0-9a-f]+)/);
            if (usdcPattern && !details.amount) {
                const lengthByte = parseInt(usdcPattern[1], 16);
                const amountHex = usdcPattern[2].substring(0, lengthByte * 2);

                const amount =
                    amountHex
                        .match(/.{1,2}/g)
                        ?.map(byte => String.fromCharCode(parseInt(byte, 16)))
                        .join("") || "";
                details.amount = amount;
                details.denom = "usdc";
            }

            return details;
        } catch (err) {
            console.error("Failed to extract transaction details:", err);
            return { type: "Unknown" };
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col justify-center items-center relative overflow-hidden">
                <AnimatedBackground />
                <div className={`backdrop-blur-md p-8 rounded-xl shadow-2xl text-center relative z-10 ${styles.containerCard}`}>
                    <div className="flex justify-center mb-4">
                        <svg
                            className={`animate-spin h-10 w-10 ${styles.brandText}`}
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Loading block #{height}...</h2>
                </div>
            </div>
        );
    }

    if (error || !block) {
        return (
            <div className="min-h-screen flex flex-col justify-center items-center relative overflow-hidden">
                <AnimatedBackground />
                <div className={`backdrop-blur-md p-8 rounded-xl shadow-2xl text-center max-w-lg relative z-10 ${styles.containerCard}`}>
                    <div className="flex justify-center mb-4">
                        <svg className={`h-16 w-16 ${styles.dangerText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Error: {error || "Block not found"}</h2>
                    <p className="text-gray-300 mb-6">Unable to load block #{height}</p>
                    <button
                        onClick={() => navigate("/explorer")}
                        className={`px-6 py-2 rounded-lg font-bold transition-colors duration-200 ${styles.primaryButton}`}
                    >
                        Back to Explorer
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center relative overflow-hidden p-6">
            <AnimatedBackground />
            <div className="w-full max-w-7xl relative z-10">
                {/* Header with Back Button */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate("/explorer")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors duration-200 mb-4 ${styles.subtleBrandButton}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Explorer
                    </button>
                </div>

                {/* Block Details Card */}
                <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerCard}`}>
                    <h1 className="text-3xl font-extrabold text-white mb-6">Block #{block.block.header.height}</h1>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-gray-400 text-sm mb-1">Block Hash</p>
                            <p
                                className={`font-mono text-sm cursor-pointer transition-colors duration-200 break-all ${styles.brandText} ${styles.brandTextHover}`}
                                onClick={() => copyToClipboard(block.block_id.hash)}
                                title="Click to copy"
                            >
                                {block.block_id.hash}
                            </p>
                        </div>

                        <div>
                            <p className="text-gray-400 text-sm mb-1">Timestamp</p>
                            <p className="text-white font-mono text-sm">{formatTimestamp(block.block.header.time)}</p>
                        </div>

                        <div>
                            <p className="text-gray-400 text-sm mb-1">Chain ID</p>
                            <p className="text-white font-mono text-sm">{block.block.header.chain_id}</p>
                        </div>

                        <div>
                            <p className="text-gray-400 text-sm mb-1">Proposer Address</p>
                            <p className="font-mono text-sm">
                                <ClickableAddress address={formatProposerAddress(block.block.header.proposer_address || "")} />
                            </p>
                        </div>

                        <div>
                            <p className="text-gray-400 text-sm mb-1">Number of Transactions</p>
                            <p className={`text-white font-bold text-lg ${styles.successText}`}>
                                {block.block.data.txs.length}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Transactions Card */}
                <div className={`backdrop-blur-md rounded-xl shadow-2xl overflow-hidden ${styles.containerCard}`}>
                    <div className={`px-6 py-4 ${styles.headerCard}`}>
                        <h2 className="text-2xl font-bold text-white">Transactions {block.block.data.txs.length > 0 && `(${block.block.data.txs.length})`}</h2>
                    </div>

                    <div className="p-6">
                        {block.block.data.txs.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-400 text-lg">No transactions in this block</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {block.block.data.txs.map((tx: string, index: number) => {
                                    const txHex = decodeTransaction(tx);
                                    const txDetails = extractTransactionDetails(txHex);
                                    const showRawData = expandedTxs.has(index);
                                    const txHashValue = txHashes[index] || "Computing...";

                                    return (
                                        <div
                                            key={index}
                                            className={`p-5 rounded-lg transition-colors duration-200 ${styles.txCard}`}
                                        >
                                            {/* Transaction Header */}
                                            <div
                                                className={`flex items-center justify-between mb-4 pb-3 ${styles.txHeader}`}
                                            >
                                                <div className="flex-1">
                                                    <p className="text-gray-400 text-sm font-bold">Transaction #{index + 1}</p>
                                                    <p className={`text-xl font-bold mt-1 ${styles.successText}`}>
                                                        {txDetails.type}
                                                    </p>
                                                    {txHashValue !== "Computing..." && (
                                                        <div className="mt-2">
                                                            <p className="text-gray-400 text-xs mb-1">Transaction Hash</p>
                                                            <Link
                                                                to={`/explorer/tx/${txHashValue}`}
                                                                className={`font-mono text-xs cursor-pointer transition-colors duration-200 break-all ${styles.brandText} ${styles.brandTextHover}`}
                                                                title="Click to view transaction details"
                                                            >
                                                                {txHashValue}
                                                            </Link>
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => copyToClipboard(txHex)}
                                                    className={`px-3 py-1 rounded text-xs font-bold transition-colors duration-200 ml-4 ${styles.copyRawButton}`}
                                                >
                                                    Copy Raw
                                                </button>
                                            </div>

                                            {/* Transaction Details */}
                                            <div className="space-y-3 mb-4">
                                                {txDetails.from && (
                                                    <div>
                                                        <p className="text-gray-400 text-xs mb-1">From</p>
                                                        <p className="font-mono text-sm">
                                                            <ClickableAddress address={txDetails.from} showFull={true} />
                                                        </p>
                                                    </div>
                                                )}

                                                {txDetails.to && (
                                                    <div>
                                                        <p className="text-gray-400 text-xs mb-1">To</p>
                                                        <p className="font-mono text-sm">
                                                            <ClickableAddress address={txDetails.to} showFull={true} />
                                                        </p>
                                                    </div>
                                                )}

                                                {txDetails.amount && (
                                                    <div>
                                                        <p className="text-gray-400 text-xs mb-1">Amount</p>
                                                        <p className="text-white font-bold text-lg">
                                                            {txDetails.amount}{" "}
                                                            <span className={`text-sm ${styles.secondaryBrandText}`}>
                                                                {txDetails.denom}
                                                            </span>
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Show/Hide Raw Data */}
                                            <button
                                                onClick={() => toggleRawData(index)}
                                                className={`text-xs font-bold transition-colors duration-200 mb-2 ${styles.brandText} ${styles.brandTextHover}`}
                                            >
                                                {showRawData ? "▼ Hide Raw Data" : "▶ Show Raw Data"}
                                            </button>

                                            {showRawData && (
                                                <div
                                                    className={`p-3 rounded mt-2 ${styles.rawDataBox}`}
                                                >
                                                    <p
                                                        className={`font-mono text-xs break-all cursor-pointer transition-colors duration-200 ${styles.brandText} ${styles.brandTextHover}`}
                                                        onClick={() => copyToClipboard(txHex)}
                                                        title="Click to copy raw data"
                                                    >
                                                        {txHex}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
