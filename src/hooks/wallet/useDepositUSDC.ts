import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useCallback, useMemo } from "react";
import { COSMOS_BRIDGE_ADDRESS } from "../../config/constants";
import { parseAbi } from "viem";

// CosmosBridge ABI - includes both deposit methods
const COSMOS_BRIDGE_ABI = parseAbi([
    "function depositUnderlying(uint256 amount, string calldata receiver) external returns(uint256)",
    "function deposit(uint256 amount, string calldata receiver, address token) external returns(uint256)"
]);

const useDepositUSDC = () => {
    const { data: hash, mutateAsync, isPending, error } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash
    });

    // Deposit USDC directly via depositUnderlying - receiver is a Cosmos address string (e.g., "b521...")
    const deposit = useCallback(
        async (amount: bigint, cosmosReceiver: string): Promise<void> => {
            try {
                await mutateAsync({
                    address: COSMOS_BRIDGE_ADDRESS as `0x${string}`,
                    abi: COSMOS_BRIDGE_ABI,
                    functionName: "depositUnderlying",
                    args: [amount, cosmosReceiver]
                });
            } catch (err) {
                console.error("CosmosBridge deposit failed:", err);
                throw err;
            }
        },
        [mutateAsync]
    );

    // Deposit any ERC20 token via deposit() - auto-swaps to USDC if not the underlying token
    const depositToken = useCallback(
        async (amount: bigint, cosmosReceiver: string, tokenAddress: string): Promise<void> => {
            try {
                await mutateAsync({
                    address: COSMOS_BRIDGE_ADDRESS as `0x${string}`,
                    abi: COSMOS_BRIDGE_ABI,
                    functionName: "deposit",
                    args: [amount, cosmosReceiver, tokenAddress as `0x${string}`]
                });
            } catch (err) {
                console.error("CosmosBridge depositToken failed:", err);
                throw err;
            }
        },
        [mutateAsync]
    );

    return useMemo(
        () => ({
            deposit,
            depositToken,
            isDepositPending: isConfirming,
            isDepositConfirmed: isConfirmed,
            isPending,
            hash,
            depositError: error
        }),
        [deposit, depositToken, isConfirming, isPending, isConfirmed, hash, error]
    );
};

export { useDepositUSDC };
export default useDepositUSDC;
