/**
 * useSignMessage - Hook for signing messages with the connected wallet
 *
 * Uses wagmi's useSignMessage which properly integrates with AppKit/WalletConnect
 * instead of directly accessing window.ethereum.
 */

import { useSignMessage as useWagmiSignMessage } from "wagmi";
import { useCallback, useMemo } from "react";

interface UseSignMessageReturn {
    /**
     * Signs `message`. Pass `account` to require that address: without it the
     * wallet signs with whichever account it has selected, which may not be
     * the address the app shows (ui#733).
     */
    signMessage: (message: string, account?: string) => Promise<string>;
    isPending: boolean;
    error: Error | null;
}

export const useSignMessage = (): UseSignMessageReturn => {
    const { signMessageAsync, isPending, error } = useWagmiSignMessage();

    const signMessage = useCallback(
        async (message: string, account?: string): Promise<string> => {
            const signature = await signMessageAsync(account ? { message, account: account as `0x${string}` } : { message });
            return signature;
        },
        [signMessageAsync]
    );

    return useMemo(
        () => ({
            signMessage,
            isPending,
            error: error || null
        }),
        [signMessage, isPending, error]
    );
};

export default useSignMessage;
