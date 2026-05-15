import React, { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { useBrokerApi } from "../context/BrokerApiContext";

type Status =
    | { kind: "idle" }
    | { kind: "starting" }
    | { kind: "awaiting-scan"; tgLoginUrl: string }
    | { kind: "needs-password" }
    | { kind: "linking" }
    | { kind: "linked"; tgUsername: string; tgUserId: number }
    | { kind: "error"; message: string };

const SESSION_KEY_PREFIX = "telegram_session:";

export const LinkTelegramPage: React.FC = () => {
    const { address: cosmosAddress } = useCosmosWallet();
    const broker = useBrokerApi();

    const [status, setStatus] = useState<Status>({ kind: "idle" });
    const [password, setPassword] = useState("");

    // Hold the gramjs client across renders so password submission can resume the flow.
    const clientRef = useRef<unknown>(null);
    const passwordResolverRef = useRef<((pw: string) => void) | null>(null);

    const apiId = Number(import.meta.env.VITE_TG_API_ID);
    const apiHash = String(import.meta.env.VITE_TG_API_HASH || "");
    const credsConfigured = Number.isFinite(apiId) && apiId > 0 && apiHash !== "";

    const startQrLogin = useCallback(async () => {
        if (!cosmosAddress) {
            setStatus({ kind: "error", message: "Connect your Cosmos wallet first." });
            return;
        }
        if (!credsConfigured) {
            setStatus({
                kind: "error",
                message: "VITE_TG_API_ID and VITE_TG_API_HASH are not configured."
            });
            return;
        }

        setStatus({ kind: "starting" });

        try {
            // Lazy-load gramjs — keeps the main bundle slim.
            const [{ TelegramClient }, { StringSession }] = await Promise.all([
                import("telegram"),
                import("telegram/sessions")
            ]);

            const sessionKey = SESSION_KEY_PREFIX + cosmosAddress;
            const savedSession = window.localStorage.getItem(sessionKey) || "";
            const session = new StringSession(savedSession);

            const client = new TelegramClient(session, apiId, apiHash, { connectionRetries: 5 });
            clientRef.current = client;

            await client.connect();

            const user = await client.signInUserWithQrCode(
                { apiId, apiHash },
                {
                    qrCode: async code => {
                        // Telegram QR login URLs require base64url. gramjs's Buffer polyfill
                        // doesn't always implement "base64url", so derive it from "base64".
                        const tokenBase64 = code.token.toString("base64");
                        const tokenBase64Url = tokenBase64
                            .replace(/\+/g, "-")
                            .replace(/\//g, "_")
                            .replace(/=+$/, "");
                        const url = `tg://login?token=${tokenBase64Url}`;
                        setStatus({ kind: "awaiting-scan", tgLoginUrl: url });
                    },
                    password: async () => {
                        setStatus({ kind: "needs-password" });
                        return await new Promise<string>(resolve => {
                            passwordResolverRef.current = resolve;
                        });
                    },
                    onError: async (err: Error) => {
                        console.error("Telegram QR login error:", err);
                        setStatus({ kind: "error", message: err.message });
                        return true;
                    }
                }
            );

            window.localStorage.setItem(sessionKey, session.save());

            const tgUserId = Number(user.id);
            const tgUsername =
                "username" in user && typeof user.username === "string" ? user.username : "";

            setStatus({ kind: "linking" });

            await broker.postBinding({
                walletAddress: cosmosAddress,
                tgUserId,
                tgUsername
            });

            setStatus({ kind: "linked", tgUsername: tgUsername || `id:${tgUserId}`, tgUserId });
        } catch (err) {
            console.error("Telegram link failed:", err);
            const message = err instanceof Error ? err.message : "Unknown error";
            setStatus({ kind: "error", message });
        }
    }, [apiHash, apiId, broker, cosmosAddress, credsConfigured]);

    const submitPassword = useCallback(() => {
        const resolve = passwordResolverRef.current;
        if (resolve) {
            passwordResolverRef.current = null;
            resolve(password);
            setPassword("");
            setStatus({ kind: "starting" });
        }
    }, [password]);

    // If the user navigates away mid-flow, drop the in-flight resolver so a
    // future visit starts cleanly.
    useEffect(() => {
        return () => {
            passwordResolverRef.current = null;
        };
    }, []);

    return (
        <div className="min-h-screen bg-[#2c3245] text-gray-100 px-6 py-10">
            <div className="max-w-xl mx-auto">
                <h1 className="text-2xl font-semibold mb-2">Link Telegram</h1>
                <p className="text-sm text-gray-400 mb-6">
                    Connect your Telegram account to this Cosmos wallet. Scan the QR code with
                    Telegram on your phone (Settings → Devices → Link Desktop Device).
                </p>

                {!cosmosAddress && (
                    <div className="bg-amber-900/30 border border-amber-700 rounded p-4 text-sm">
                        No Cosmos wallet detected. Import a seed phrase first.
                    </div>
                )}

                {cosmosAddress && (
                    <div className="bg-gray-800/40 rounded p-4 text-xs text-gray-300 mb-6">
                        Wallet: <span className="font-mono">{cosmosAddress}</span>
                    </div>
                )}

                {status.kind === "idle" && cosmosAddress && (
                    <button
                        onClick={startQrLogin}
                        disabled={!credsConfigured}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white"
                    >
                        Start QR login
                    </button>
                )}

                {!credsConfigured && (
                    <p className="text-xs text-amber-400 mt-2">
                        VITE_TG_API_ID / VITE_TG_API_HASH not set — see .env.example.
                    </p>
                )}

                {status.kind === "starting" && <p className="text-sm text-gray-300">Loading…</p>}

                {status.kind === "awaiting-scan" && (
                    <div className="mt-4">
                        <div className="bg-white p-4 rounded-lg inline-block">
                            <QRCodeSVG value={status.tgLoginUrl} size={240} level="H" />
                        </div>
                        <p className="text-sm text-gray-400 mt-3">
                            Open Telegram → Settings → Devices → Link Desktop Device, then point your camera here.
                        </p>
                    </div>
                )}

                {status.kind === "needs-password" && (
                    <div className="mt-4 space-y-3">
                        <label className="block text-sm">Two-factor password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                            autoFocus
                        />
                        <button
                            onClick={submitPassword}
                            disabled={password.length === 0}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded text-white"
                        >
                            Submit
                        </button>
                    </div>
                )}

                {status.kind === "linking" && (
                    <p className="text-sm text-gray-300 mt-4">
                        Logged in to Telegram. Registering binding with the broker…
                    </p>
                )}

                {status.kind === "linked" && (
                    <div className="bg-emerald-900/30 border border-emerald-700 rounded p-4 text-sm mt-4">
                        Linked Telegram as <strong>@{status.tgUsername}</strong> (id {status.tgUserId}).
                    </div>
                )}

                {status.kind === "error" && (
                    <div className="bg-red-900/30 border border-red-700 rounded p-4 text-sm mt-4">
                        {status.message}
                        <button onClick={() => setStatus({ kind: "idle" })} className="ml-3 underline">
                            Try again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LinkTelegramPage;
