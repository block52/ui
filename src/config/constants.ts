// Always use production proxy for testing
export const PROXY_URL = "https://poker-vm-proxy-js-ixe4h.ondigitalocean.app";

// Ethereum Mainnet
export const ETH_CHAIN_ID = 1;
export const ETH_RPC_URL = "https://eth.llamarpc.com";
export const ETH_USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const ETH_USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const COSMOS_BRIDGE_ADDRESS = "0xE4E22A524f2b104cB71fB154f72736bd02722fF4"; // Deployed 2026-02-11

// SngWinNFT — commemorative ERC-721 for paid SNG finishes.
// TODO(block52/poker-vm#2119): replace with the deployed Ethereum
// Mainnet address once contracts/SngWinNFT.sol is deployed and
// Etherscan-verified. While unset the Claim NFT button surfaces a
// "feature not yet live" error in the UI rather than dispatching a
// transaction to the zero address.
export const SNG_WIN_NFT_ADDRESS = "0x0000000000000000000000000000000000000000";

// Hot wallet deposit address (QR deposit flow)
export const DEPOSIT_ADDRESS = "0xADB8401D85E203F101aC715D5Aa7745a0ABcd42C";
