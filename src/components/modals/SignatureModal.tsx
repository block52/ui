import React from "react";
import { copyToClipboard } from "../../utils/clipboard";
import { formatMicroAsUsdc } from "../../constants/currency";
import { Modal } from "../common/Modal";
import { PillButton } from "../ui";
import { fieldLabelClass, insetBoxClass, noticeClass } from "./walletFormClasses";
import { CopyIcon } from "./walletIcons";

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

interface CopyFieldProps {
    label: string;
    value: string;
    copyLabel: string;
    valueClass?: string;
    breakAll?: boolean;
}

const CopyField: React.FC<CopyFieldProps> = ({ label, value, copyLabel, valueClass = "text-ink-body", breakAll = true }) => (
    <div className="mb-4">
        <span className={fieldLabelClass}>{label}</span>
        <div className={`${insetBoxClass} flex items-start justify-between gap-3`}>
            <code className={`text-sm font-mono tabular-nums min-w-0 ${breakAll ? "break-all" : "break-words"} ${valueClass}`}>{value}</code>
            <button
                type="button"
                onClick={() => copyToClipboard(value, `${copyLabel} copied!`)}
                aria-label={`Copy ${label}`}
                className="shrink-0 w-10 h-10 -my-2 -mr-2 grid place-items-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            >
                <CopyIcon />
            </button>
        </div>
    </div>
);

const SignatureModal: React.FC<SignatureModalProps> = ({
    isOpen,
    onClose,
    withdrawal,
    signatureHex,
    bridgeContractAddress
}) => {
    if (!isOpen || !withdrawal) return null;

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

    const statusClass =
        withdrawal.status === "signed"
            ? "text-brand-light"
            : withdrawal.status === "completed"
              ? "text-emerald-400"
              : withdrawal.status === "pending"
                ? "text-amber-400"
                : "text-red-400";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Signature Details" widthClass="w-[672px]">
            <div className={`${insetBoxClass} mb-5`}>
                <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted mb-3">
                    Withdrawal Information
                </h3>
                <div className="space-y-3">
                    <div className="flex justify-between items-center gap-3">
                        <span className="text-ink-muted text-sm">Status:</span>
                        <span className={`font-semibold text-sm ${statusClass}`}>
                            {withdrawal.status.toUpperCase()}
                        </span>
                    </div>
                    <div className="flex justify-between items-center gap-3">
                        <span className="text-ink-muted text-sm">Amount:</span>
                        <span className="text-ink font-semibold tabular-nums">
                            {formatMicroAsUsdc(withdrawal.amount, 6)} USDC
                        </span>
                    </div>
                    <div className="flex justify-between items-center gap-3">
                        <span className="text-ink-muted text-sm">Amount (raw):</span>
                        <span className="text-ink-soft font-mono text-sm tabular-nums">{withdrawal.amount}</span>
                    </div>
                </div>
            </div>

            <CopyField label="Nonce" value={withdrawal.nonce} copyLabel="Nonce" />
            <CopyField
                label="Receiver (Ethereum Address)"
                value={withdrawal.baseAddress}
                copyLabel="Address"
            />
            <CopyField
                label="Cosmos Address"
                value={withdrawal.cosmosAddress}
                copyLabel="Cosmos address"
            />
            <CopyField
                label="Bridge Contract Address"
                value={bridgeContractAddress}
                copyLabel="Contract address"
                valueClass="text-brand-light"
            />

            {withdrawal.signature ? (
                <>
                    <div className="border-t border-line my-6" />
                    <h3 className="text-base font-semibold text-ink mb-4">Validator Signature</h3>

                    <CopyField
                        label="Signature (Base64)"
                        value={withdrawal.signature}
                        copyLabel="Base64 signature"
                    />

                    {signatureHex && (
                        <CopyField
                            label="Signature (Hex)"
                            value={signatureHex}
                            copyLabel="Hex signature"
                        />
                    )}

                    {sigComponents && (
                        <div className="mb-4">
                            <span className={fieldLabelClass}>Signature Components (r, s, v)</span>
                            <div className={`${insetBoxClass} space-y-3`}>
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-ink-muted text-xs">r:</span>
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(sigComponents.r, "r component copied!")}
                                            aria-label="Copy r component"
                                            className="w-10 h-10 -my-2 -mr-2 grid place-items-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
                                        >
                                            <CopyIcon />
                                        </button>
                                    </div>
                                    <code className="text-ink-body text-xs font-mono break-all">{sigComponents.r}</code>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-ink-muted text-xs">s:</span>
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(sigComponents.s, "s component copied!")}
                                            aria-label="Copy s component"
                                            className="w-10 h-10 -my-2 -mr-2 grid place-items-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
                                        >
                                            <CopyIcon />
                                        </button>
                                    </div>
                                    <code className="text-ink-body text-xs font-mono break-all">{sigComponents.s}</code>
                                </div>
                                <div>
                                    <span className="text-ink-muted text-xs">v: </span>
                                    <code className="text-ink-body text-sm font-mono tabular-nums">
                                        {sigComponents.v} (0x{sigComponents.v.toString(16)})
                                    </code>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="text-xs text-ink-muted tabular-nums mb-4">
                        Signature length: {signatureHex ? signatureHex.length - 2 : 0} hex chars ({signatureHex ? (signatureHex.length - 2) / 2 : 0} bytes)
                    </div>
                </>
            ) : (
                <div className={`mb-4 ${noticeClass.warning}`}>
                    No signature available. The validator has not signed this withdrawal yet.
                </div>
            )}

            {withdrawal.txHash && (
                <CopyField
                    label="Ethereum Tx Hash"
                    value={withdrawal.txHash}
                    copyLabel="Tx hash"
                />
            )}

            <div className="mt-6">
                <PillButton variant="outline" size="lg" className="w-full" onClick={onClose}>
                    Close
                </PillButton>
            </div>
        </Modal>
    );
};

export default SignatureModal;
