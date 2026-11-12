/**
 * useTableHeader Hook
 *
 * Manages all header-related state and logic including:
 * - Cosmos wallet balance fetching
 * - Table link copying
 * - Navigation
 * - Styling
 */

import { useState, useCallback, useEffect } from "react";
import { useNetwork } from "../../../../context/NetworkContext";
import { getCosmosBalance, getCosmosAddressSync, getFormattedCosmosAddress } from "../../../../utils/cosmosAccountUtils";
import { formatUSDCToSimpleDollars } from "../../../../utils/numberUtils";
import {
    copyToClipboard,
    navigateToLobby,
    getHeaderStyle,
    getSubHeaderStyle,
    getWalletInfoStyle,
    getBalanceIconStyle,
    getDepositButtonStyle
} from "../utils";
import { UseTableHeaderReturn } from "../types";
import { tableUrl } from "../../../../utils/tableUrl";

export const useTableHeader = (tableId: string): UseTableHeaderReturn => {
    const { currentNetwork } = useNetwork();
    const publicKey = getCosmosAddressSync();

    // Balance state
    const [accountBalance, setAccountBalance] = useState<string>("0");
    const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(true);
    const [, setBalanceError] = useState<Error | null>(null);

    // Hover state for deposit button
    const [isDepositHovered, setIsDepositHovered] = useState(false);

    // Fetch Cosmos account balance
    const fetchAccountBalance = useCallback(async () => {
        try {
            setIsBalanceLoading(true);
            setBalanceError(null);

            const balance = await getCosmosBalance(currentNetwork, "usdc");
            setAccountBalance(balance);
        } catch (err) {
            console.error("Error fetching Cosmos balance:", err);
            setBalanceError(err instanceof Error ? err : new Error("Failed to fetch balance"));
        } finally {
            setIsBalanceLoading(false);
        }
    }, [currentNetwork]);

    // Fetch balance on mount
    useEffect(() => {
        if (publicKey) {
            fetchAccountBalance();
        }
    }, [publicKey, fetchAccountBalance]);

    // Handle copy table link
    const handleCopyTableLink = useCallback(() => {
        copyToClipboard(`${window.location.origin}${tableUrl(tableId)}`, "Table link copied!");
    }, [tableId]);

    // Handle deposit click
    const handleDepositClick = useCallback(() => {
        window.location.href = "/";
    }, []);

    // Handle lobby click
    const handleLobbyClick = useCallback(() => {
        navigateToLobby();
    }, []);

    // Handle copy address to clipboard
    const handleCopyToClipboard = useCallback((text: string) => {
        copyToClipboard(text);
    }, []);

    // Deposit button hover handlers
    const handleDepositMouseEnter = useCallback(() => {
        setIsDepositHovered(true);
    }, []);

    const handleDepositMouseLeave = useCallback(() => {
        setIsDepositHovered(false);
    }, []);

    // Computed values
    const formattedAddress = getFormattedCosmosAddress();
    const balanceFormatted = formatUSDCToSimpleDollars(accountBalance);

    // Styles
    const headerStyle = getHeaderStyle();
    const subHeaderStyle = getSubHeaderStyle();
    const walletInfoStyle = getWalletInfoStyle();
    const balanceIconStyle = getBalanceIconStyle();
    const depositButtonStyle = getDepositButtonStyle(isDepositHovered);

    return {
        // Balance data
        accountBalance,
        isBalanceLoading,
        balanceFormatted,

        // User data
        publicKey,
        formattedAddress,

        // Actions
        fetchAccountBalance,
        handleCopyTableLink,
        handleDepositClick,
        handleLobbyClick,
        copyToClipboard: handleCopyToClipboard,

        // Styles
        headerStyle,
        subHeaderStyle,
        walletInfoStyle,
        balanceIconStyle,
        depositButtonStyle,

        // Hover state
        isDepositHovered,
        handleDepositMouseEnter,
        handleDepositMouseLeave
    };
};
