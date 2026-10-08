import { useCallback } from "react";
import { NETWORK_PRESETS, useNetwork } from "../../context/NetworkContext";
import { useCosmosApiFactory } from "../../context/CosmosApiContext";
import { httpErrorMessage } from "../../apis/HTTPClient";
import { signatureEndpoints, verifyWithdrawalSignature, type WithdrawalToSign } from "../../utils/withdrawalSignature";

/**
 * Fetches a validator's signature for a withdrawal, so it can be redeemed on
 * Ethereum without waiting for one to be stored on chain (pokerchain#392).
 * Asks the current network, then the official Block52 validator; every reply
 * is checked against the withdrawal before it is returned.
 */
export const useWithdrawalSignature = () => {
    const { currentNetwork } = useNetwork();
    const apiFor = useCosmosApiFactory();

    return useCallback(
        async (withdrawal: WithdrawalToSign): Promise<string> => {
            const failures: string[] = [];
            for (const network of signatureEndpoints(currentNetwork, NETWORK_PRESETS)) {
                try {
                    const reply = await apiFor(network.rest).getWithdrawalSignature(withdrawal.nonce);
                    return verifyWithdrawalSignature(withdrawal, reply).signature;
                } catch (err) {
                    failures.push(`${network.name}: ${httpErrorMessage(err, "no reply")}`);
                }
            }
            console.error("[useWithdrawalSignature] No validator signature:", failures);
            throw new Error(`No validator could sign this withdrawal right now (${failures.join("; ")})`);
        },
        [currentNetwork, apiFor]
    );
};

export default useWithdrawalSignature;
