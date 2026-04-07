import React from "react";
import { toast } from "react-toastify";
import { formatMicroAsUsdc } from "../../constants/currency";

interface Withdrawal {
    nonce: string;
    cosmosAddress: string;
    baseAddress: string;
    amount: string;
    amountFormatted: string;
    status: "pending" | "signed" | "completed" | "error";
    signature?: string;
    errorMessage?: string;
    txHash?: string;
}

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    withdrawal: Withdrawal | null;
    signatureHex: string | null;
    bridgeContractAddress: string;
}

/**
 * SignatureModal - Displays raw signature data for debugging withdrawals
 *
 * Shows the complete signature information including:
 * - Base64 encoded signature (from validator)
 * - Hex encoded signature (for Ethereum contract)
 * - Withdrawal parameters (nonce, amount, receiver)
 * - Bridge contract address
 */
const SignatureModal: React.FC<SignatureModalProps> = ({
    isOpen,
    onClose,
    withdrawal,
    signatureHex,
    bridgeContractAddress
}) => {
    if (!isOpen || !withdrawal) return null;

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    // Parse signature components (r, s, v) from hex signature
    const parseSignatureComponents = (hexSig: string | null) => {
        if (!hexSig || hexSig.length < 132) return null;

        const sig = hexSig.startsWith("0x") ? hexSig.slice(2) : hexSig;
        if (sig.length !== 130) return null;

        return {
            r: "0x" + sig.slice(0, 64),
            s: "0x" + sig.slice(64, 128),
            v: parseInt(sig.slice(128, 130), 16)
        };
    };

    const sigComponents = parseSignatureComponents(signatureHex);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Signature Details</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Withdrawal Info */}
                <div className="mb-6 bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                        Withdrawal Information
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Status:</span>
                            <span className={`font-semibold ${
                                withdrawal.status === "signed" ? "text-blue-400" :
                                withdrawal.status === "completed" ? "text-green-400" :
                                withdrawal.status === "pending" ? "text-yellow-400" :
                                "text-red-400"
                            }`}>
                                {withdrawal.status.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Amount:</span>
                            <span className="text-white font-semibold">
                                {formatMicroAsUsdc(withdrawal.amount, 6)} USDC
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Amount (raw):</span>
                            <span className="text-gray-300 font-mono text-sm">{withdrawal.amount}</span>
                        </div>
                    </div>
                </div>

                {/* Nonce */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                            Nonce
                        </label>
                        <button
                            onClick={() => copyToClipboard(withdrawal.nonce, "Nonce")}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            Copy
                        </button>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                        <code className="text-green-400 text-sm font-mono break-all">{withdrawal.nonce}</code>
                    </div>
                </div>

                {/* Receiver Address */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                            Receiver (Ethereum Address)
                        </label>
                        <button
                            onClick={() => copyToClipboard(withdrawal.baseAddress, "Address")}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            Copy
                        </button>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                        <code className="text-green-400 text-sm font-mono">{withdrawal.baseAddress}</code>
                    </div>
                </div>

                {/* Cosmos Address */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                            Cosmos Address
                        </label>
                        <button
                            onClick={() => copyToClipboard(withdrawal.cosmosAddress, "Cosmos address")}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            Copy
                        </button>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                        <code className="text-green-400 text-sm font-mono break-all">{withdrawal.cosmosAddress}</code>
                    </div>
                </div>

                {/* Bridge Contract */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                            Bridge Contract Address
                        </label>
                        <button
                            onClick={() => copyToClipboard(bridgeContractAddress, "Contract address")}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            Copy
                        </button>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                        <code className="text-purple-400 text-sm font-mono">{bridgeContractAddress}</code>
                    </div>
                </div>

                {/* Signature Section */}
                {withdrawal.signature ? (
                    <>
                        <div className="border-t border-gray-700 my-6" />
                        <h3 className="text-lg font-bold text-white mb-4">Validator Signature</h3>

                        {/* Base64 Signature */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                                    Signature (Base64)
                                </label>
                                <button
                                    onClick={() => copyToClipboard(withdrawal.signature!, "Base64 signature")}
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                    Copy
                                </button>
                            </div>
                            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                                <code className="text-yellow-400 text-sm font-mono break-all">
                                    {withdrawal.signature}
                                </code>
                            </div>
                        </div>

                        {/* Hex Signature */}
                        {signatureHex && (
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                                        Signature (Hex)
                                    </label>
                                    <button
                                        onClick={() => copyToClipboard(signatureHex, "Hex signature")}
                                        className="text-xs text-blue-400 hover:text-blue-300"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                                    <code className="text-orange-400 text-sm font-mono break-all">
                                        {signatureHex}
                                    </code>
                                </div>
                            </div>
                        )}

                        {/* Signature Components */}
                        {sigComponents && (
                            <div className="mb-4">
                                <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                                    Signature Components (r, s, v)
                                </label>
                                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-500 text-xs">r:</span>
                                            <button
                                                onClick={() => copyToClipboard(sigComponents.r, "r component")}
                                                className="text-xs text-blue-400 hover:text-blue-300"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <code className="text-cyan-400 text-xs font-mono break-all">
                                            {sigComponents.r}
                                        </code>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-500 text-xs">s:</span>
                                            <button
                                                onClick={() => copyToClipboard(sigComponents.s, "s component")}
                                                className="text-xs text-blue-400 hover:text-blue-300"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <code className="text-cyan-400 text-xs font-mono break-all">
                                            {sigComponents.s}
                                        </code>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 text-xs">v: </span>
                                        <code className="text-cyan-400 text-sm font-mono">
                                            {sigComponents.v} (0x{sigComponents.v.toString(16)})
                                        </code>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Signature Length */}
                        <div className="text-xs text-gray-500 mb-4">
                            Signature length: {signatureHex ? signatureHex.length - 2 : 0} hex chars ({signatureHex ? (signatureHex.length - 2) / 2 : 0} bytes)
                        </div>
                    </>
                ) : (
                    <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                        <p className="text-yellow-400 text-sm">
                            No signature available. The validator has not signed this withdrawal yet.
                        </p>
                    </div>
                )}

                {/* Tx Hash if completed */}
                {withdrawal.txHash && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                                Ethereum Tx Hash
                            </label>
                            <button
                                onClick={() => copyToClipboard(withdrawal.txHash!, "Tx hash")}
                                className="text-xs text-blue-400 hover:text-blue-300"
                            >
                                Copy
                            </button>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                            <code className="text-green-400 text-sm font-mono break-all">{withdrawal.txHash}</code>
                        </div>
                    </div>
                )}

                {/* Close Button */}
                <div className="mt-6">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignatureModal;
