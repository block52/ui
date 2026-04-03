import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { NounsGlasses } from "../components/playPage/Table/components/NounsGlasses";
import { useCosmosWallet, useFindGames } from "../hooks";
import { formatMicroAsUsdc } from "../constants/currency";

const NounsLandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { address, balance, isLoading: walletLoading } = useCosmosWallet();
    const { games, isLoading: gamesLoading } = useFindGames();

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
                fontFamily: "'Silkscreen', monospace",
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

            {/* Balance card */}
            {address && (
                <div
                    className="rounded-xl px-8 py-6 mb-10 text-center"
                    style={{
                        border: "2px solid #e5e5e5",
                        minWidth: 260,
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
            )}

            {/* Play now button */}
            <button
                onClick={handlePlayNow}
                className="px-10 py-4 text-lg font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                style={{
                    background: "#d63c5e",
                    color: "#ffffff",
                    border: "none",
                    letterSpacing: "0.05em",
                }}
            >
                Play Now
            </button>

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
