import React from "react";
import { useCosmosWallet } from "../../hooks";
import { microToUsdc } from "../../constants/currency";
import DepositCore from "./DepositCore";
import type { USDCDepositModalProps } from "./types";
import { Modal } from "../common/Modal";

const USDCDepositModal: React.FC<USDCDepositModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const cosmosWallet = useCosmosWallet();
    const [isDepositPending, setIsDepositPending] = React.useState(false);

    const b52Balance = React.useMemo(() => {
        const usdcBalance = cosmosWallet.balance.find(b => b.denom === "usdc");
        if (!usdcBalance) return "0.00";
        return microToUsdc(usdcBalance.amount).toFixed(2);
    }, [cosmosWallet.balance]);

    const handleSuccess = () => {
        if (onSuccess) onSuccess();
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Deposit" subtitle="Add USDC to your game wallet" widthClass="w-full max-w-[460px]" isProcessing={isDepositPending}>
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-surface-raised border border-line flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.08em] text-ink-muted">Game wallet balance</span>
                <span className="text-base font-semibold tabular-nums text-ink">
                    ${b52Balance} <span className="text-sm font-medium text-ink-muted">USDC</span>
                </span>
            </div>

            <DepositCore onSuccess={handleSuccess} onCancel={onClose} onPendingChange={setIsDepositPending} showMethodSelector={true} />
        </Modal>
    );
};

export default USDCDepositModal;
