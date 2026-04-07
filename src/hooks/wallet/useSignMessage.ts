/**
 * useSignMessage - Hook for signing messages with the connected wallet
 *
 * Uses wagmi's useSignMessage which properly integrates with AppKit/WalletConnect
 * instead of directly accessing window.ethereum.
 */

import { useSignMessage as useWagmiSignMessage } from "wagmi";
import { useCallback, useMemo } from "react";

interface UseSignMessageReturn {
    signMessage: (message: string) => Promise<string>;
    isPending: boolean;
    error: Error | null;
}

export const useSignMessage = (): UseSignMessageReturn => {
    const { signMessageAsync, isPending, error } = useWagmiSignMessage();

    const signMessage = useCallback(
        async (message: string): Promise<string> => {
            const signature = await signMessageAsync({ message });
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
