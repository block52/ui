/**
 * Wallet Hooks
 *
 * Hooks for wallet connection, balance management, and token operations.
 * Includes both Cosmos wallet (for gameplay) and Ethereum wallet (for deposits/withdrawals).
 */

// Primary Wallet Hooks
export { useCosmosWallet } from "./useCosmosWallet";

// Deposit & Bridge Hooks
export { default as useDepositUSDC } from "./useDepositUSDC";
export { default as useWithdraw } from "./useWithdraw";
export { default as useAllowance } from "./useAllowance";
export { default as useApprove } from "./useApprove";
export { default as useWalletBalance } from "./useWalletBalance";
export { default as useDecimals } from "./useDecimals";
export { default as useUserWalletConnect } from "./useUserWalletConnect";
