import { useCallback, useState } from "react";
import type { CreateValidatorParams } from "@block52/poker-vm-sdk";
import { useNetwork } from "../../context/NetworkContext";
import { getSigningClient } from "../../utils/cosmos/client";

export type CreateValidatorInput = Omit<CreateValidatorParams, "operatorAddress">;

/**
 * useCreateValidator: bonds a validator from the connected Block52 wallet
 * (MsgCreateValidator via the SDK). The wallet's account becomes the operator.
 * Resolves to the tx hash; the SDK throws if the chain rejects the tx.
 */
export const useCreateValidator = () => {
    const { currentNetwork } = useNetwork();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const createValidator = useCallback(
        async (input: CreateValidatorInput): Promise<string | null> => {
            setIsSubmitting(true);
            setError(null);
            setTxHash(null);
            try {
                const { signingClient } = await getSigningClient(currentNetwork);
                const hash = await signingClient.createValidator(input);
                setTxHash(hash);
                return hash;
            } catch (err) {
                console.error("[useCreateValidator] create-validator failed:", err);
                setError(err instanceof Error ? err.message : "Failed to create validator");
                return null;
            } finally {
                setIsSubmitting(false);
            }
        },
        [currentNetwork]
    );

    return { createValidator, isSubmitting, error, txHash };
};
