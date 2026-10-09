import React, { useCallback, useMemo, useState } from "react";
import { Modal } from "../common/Modal";
import { PillButton } from "../ui";
import { ModalFooter } from "./ModalFooter";
import { AmountPreset, AmountPresets } from "./AmountPresets";
import { CheckIcon } from "./walletIcons";
import { amountInputClass, fieldInputClass, fieldLabelClass, inlinePillClass, noticeClass } from "./walletFormClasses";

export interface SendModalProps {
    isOpen: boolean;
    /** Available USDC, already formatted for display. */
    balanceDisplay: string;
    recipient: string;
    amount: string;
    error: string;
    isSending: boolean;
    isValidRecipient: boolean;
    isAmountExceedingBalance: boolean;
    onRecipientChange: (value: string) => void;
    onAmountChange: (value: string) => void;
    onSend: () => void;
    onCancel: () => void;
}

const MICRO_PER_USDC = 1_000_000;

/** Percent of the balance, rounded down to micro-USDC so it never exceeds it. */
const percentOfBalance = (balance: number, percent: number): string => {
    const micro = Math.floor((Math.round(balance * MICRO_PER_USDC) * percent) / 100);
    return (micro / MICRO_PER_USDC).toFixed(6);
};

/**
 * Send USDC to another Block52 address. Presentation only: validation, signing
 * and the transfer call stay with the owner (Dashboard's handleCosmosTransfer).
 */
const SendModal: React.FC<SendModalProps> = ({
    isOpen,
    balanceDisplay,
    recipient,
    amount,
    error,
    isSending,
    isValidRecipient,
    isAmountExceedingBalance,
    onRecipientChange,
    onAmountChange,
    onSend,
    onCancel
}) => {
    const [canPaste] = useState(() => typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function");

    const balance = useMemo(() => parseFloat(balanceDisplay), [balanceDisplay]);
    const hasBalance = !isNaN(balance) && balance > 0;

    const presets = useMemo<AmountPreset[]>(
        () =>
            hasBalance
                ? [
                      { label: "25%", value: percentOfBalance(balance, 25) },
                      { label: "50%", value: percentOfBalance(balance, 50) },
                      { label: "75%", value: percentOfBalance(balance, 75) },
                      { label: "Max", value: percentOfBalance(balance, 100) }
                  ]
                : [],
        [balance, hasBalance]
    );

    const handlePaste = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            onRecipientChange(text.trim());
        } catch (err) {
            console.error("Failed to read clipboard:", err);
        }
    }, [onRecipientChange]);

    const recipientInvalid = recipient !== "" && !isValidRecipient;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title="Send USDC"
            subtitle="To another Block52 address"
            widthClass="w-full max-w-[460px]"
            error={error || null}
            isProcessing={isSending}
        >
            <div className="space-y-5">
                <div>
                    <label htmlFor="send-recipient" className={fieldLabelClass}>
                        Recipient
                    </label>
                    <div className="relative">
                        <input
                            id="send-recipient"
                            type="text"
                            placeholder="b521…"
                            value={recipient}
                            onChange={e => onRecipientChange(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            autoFocus
                            aria-invalid={recipientInvalid}
                            aria-describedby={recipientInvalid ? "send-recipient-help" : undefined}
                            className={`${fieldInputClass} font-mono text-sm ${canPaste || isValidRecipient ? "pr-20" : ""} ${
                                recipientInvalid ? "border-red-500/60 focus:border-red-400 focus:ring-red-500/30" : ""
                            }`}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {isValidRecipient && <CheckIcon className="w-[18px] h-[18px] text-emerald-400" />}
                            {canPaste && !recipient && (
                                <button type="button" onClick={handlePaste} disabled={isSending} className={`${inlinePillClass} border-transparent`}>
                                    Paste
                                </button>
                            )}
                        </div>
                    </div>
                    {recipientInvalid && (
                        <p id="send-recipient-help" className="m-0 mt-1.5 text-xs text-red-400">
                            Enter a valid Block52 address (starts with b521)
                        </p>
                    )}
                </div>

                <div>
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                        <label htmlFor="send-amount" className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
                            Amount
                        </label>
                        <span className="text-xs text-ink-muted tabular-nums">Available ${balanceDisplay}</span>
                    </div>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-ink-muted pointer-events-none" aria-hidden="true">
                            $
                        </span>
                        <input
                            id="send-amount"
                            type="number"
                            inputMode="decimal"
                            step="0.000001"
                            placeholder="0.00"
                            value={amount}
                            onChange={e => onAmountChange(e.target.value)}
                            aria-invalid={isAmountExceedingBalance}
                            aria-describedby={isAmountExceedingBalance ? "send-amount-help" : undefined}
                            className={`${amountInputClass} pl-9 pr-24 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                                isAmountExceedingBalance ? "border-red-500/60 focus:border-red-400 focus:ring-red-500/30" : ""
                            }`}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-muted pointer-events-none">USDC</span>
                    </div>
                    {isAmountExceedingBalance && (
                        <p id="send-amount-help" className="m-0 mt-1.5 text-xs text-red-400">
                            Amount exceeds your available balance.
                        </p>
                    )}
                    {hasBalance && (
                        <div className="mt-3">
                            <AmountPresets presets={presets} current={amount} onPick={onAmountChange} disabled={isSending} />
                        </div>
                    )}
                </div>

                <div className={noticeClass.warning} role="note">
                    Transfers on Block52 can&apos;t be reversed. Check the address before you send.
                </div>
            </div>

            <ModalFooter>
                <PillButton size="lg" className="w-full h-12" onClick={onSend} disabled={isSending || !isValidRecipient || !amount || isAmountExceedingBalance}>
                    {isSending ? "Sending..." : "Send USDC"}
                </PillButton>
                <PillButton variant="ghost" size="lg" className="w-full" onClick={onCancel} disabled={isSending}>
                    Cancel
                </PillButton>
            </ModalFooter>
        </Modal>
    );
};

export default SendModal;
