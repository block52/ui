import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useReadContract } from "wagmi";
import { NounsGlasses } from "../components/playPage/Table/components/NounsGlasses";
import { useCosmosWallet, useFindGames, useUserWalletConnect } from "../hooks";
import { formatMicroAsUsdc } from "../constants/currency";

const NOUNS_TOKEN_ADDRESS = "0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03" as const;
const NOUNS_BALANCE_ABI = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const;

const NounsLandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { address, balance, isLoading: walletLoading } = useCosmosWallet();
    const { games, isLoading: gamesLoading } = useFindGames();
    const { open, isConnected, address: ethAddress, disconnect } = useUserWalletConnect();

    const { data: nounsBalance } = useReadContract({
        address: NOUNS_TOKEN_ADDRESS,
        abi: NOUNS_BALANCE_ABI,
        functionName: "balanceOf",
        args: ethAddress ? [ethAddress as `0x${string}`] : undefined,
        chainId: 1,
    });

    const nounsDisplay = nounsBalance ? Number(nounsBalance).toString() : "0";

    const usdcBalance = useMemo(() => {
        const usdc = balance.find(b => b.denom === "usdc");
        if (usdc) {
            return formatMicroAsUsdc(usdc.amount, 2);
        }
        return "0.00";
    }, [balance]);

    const tableCount = games?.length ?? 0;

    const handlePlayNow = useCallback(() => {
        if (games && games.length > 0) {
            window.open(`/table/${games[0].gameId}`, "_blank");
            return;
        }
        navigate("/dashboard");
    }, [games, navigate]);

    return (
        <div
            className="fixed inset-0 flex flex-col items-center justify-center px-4 z-50"
            style={{
                background: "#ffffff",
                fontFamily: "'Londrina Solid', cursive",
            }}
        >
            {/* Glasses logo */}
            <div className="mb-8">
                <NounsGlasses width={280} />
            </div>

            {/* Title */}
            <h1
                className="text-4xl md:text-5xl font-bold tracking-tight mb-2"
                style={{ color: "#1a1a2e" }}
            >
                nouns.poker
            </h1>
            <p
                className="text-sm mb-12"
                style={{ color: "#888" }}
            >
                onchain poker for the nounish
            </p>

            {/* Balance cards */}
            {address && (
                <div className="flex gap-6 mb-10">
                    <div
                        className="rounded-xl px-8 py-6 text-center"
                        style={{
                            border: "2px solid #e5e5e5",
                            minWidth: 180,
                        }}
                    >
                        <p
                            className="text-xs uppercase tracking-widest mb-2"
                            style={{ color: "#aaa" }}
                        >
                            USDC Balance
                        </p>
                        <p
                            className="text-3xl font-bold"
                            style={{ color: "#1a1a2e" }}
                        >
                            {walletLoading ? "..." : `$${usdcBalance}`}
                        </p>
                    </div>
                    <div
                        className="rounded-xl px-8 py-6 text-center"
                        style={{
                            border: "2px solid #e5e5e5",
                            minWidth: 180,
                        }}
                    >
                        <p
                            className="text-xs uppercase tracking-widest mb-2"
                            style={{ color: "#aaa" }}
                        >
                            NOUNS$ Balance
                        </p>
                        <p
                            className="text-3xl font-bold"
                            style={{ color: "#1a1a2e" }}
                        >
                            {nounsDisplay}
                        </p>
                    </div>
                </div>
            )}

            {/* Connect / Play buttons */}
            <div className="flex flex-col items-stretch gap-4" style={{ minWidth: 260 }}>
                <button
                    onClick={isConnected ? disconnect : open}
                    className="px-10 py-4 text-lg font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer w-full"
                    style={{
                        background: isConnected ? "#1a1a2e" : "#2b83f6",
                        color: "#ffffff",
                        border: "none",
                        letterSpacing: "0.05em",
                    }}
                >
                    {isConnected
                        ? `${ethAddress?.slice(0, 6)}...${ethAddress?.slice(-4)}`
                        : "Connect Wallet"}
                </button>
                <button
                    onClick={handlePlayNow}
                    className="px-10 py-4 text-lg font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer w-full"
                    style={{
                        background: "#d63c5e",
                        color: "#ffffff",
                        border: "none",
                        letterSpacing: "0.05em",
                    }}
                >
                    Play Now
                </button>
            </div>

            {/* Table count */}
            {!gamesLoading && tableCount > 0 && (
                <p
                    className="mt-4 text-xs"
                    style={{ color: "#bbb" }}
                >
                    {tableCount} {tableCount === 1 ? "table" : "tables"} live
                </p>
            )}

            {/* Wallet hint if not connected */}
            {!address && !walletLoading && (
                <p
                    className="mt-8 text-xs"
                    style={{ color: "#ccc" }}
                >
                    connect a wallet to see your balance
                </p>
            )}

            {/* Footer */}
            <div
                className="absolute bottom-6 text-xs"
                style={{ color: "#ddd" }}
            >
                powered by block52
            </div>
        </div>
    );
};

export default NounsLandingPage;
