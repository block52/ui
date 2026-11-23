import { useReadContract } from "wagmi";
import useUserWalletConnect from "./useUserWalletConnect";
import { erc20abi } from "../../abis/erc20ABI";
import { FunctionName } from "@block52/poker-ui-core/types";
import { useMemo } from "react";
import {
    ETH_USDC_ADDRESS,
    ETH_CHAIN_ID
} from "../../config/constants";

const useWalletBalance = (tokenAddress: string = ETH_USDC_ADDRESS) => {
    const { address } = useUserWalletConnect();

    const wagmiContractConfig = {
        address: tokenAddress as `0x${string}`,
        abi: erc20abi,
        chainId: ETH_CHAIN_ID
    };

    const {
        data: balance,
        isLoading,
        isError
    } = useReadContract({
        ...wagmiContractConfig,
        functionName: FunctionName.Balance,
        args: [address as `0x${string}`]
    });

    return useMemo(
        () => ({
            balance,
            isLoading,
            isError
        }),
        [balance, isLoading, isError]
    );
};

export { useWalletBalance };
export default useWalletBalance;
