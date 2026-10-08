/**
 * Validator signatures for bridge withdrawals (pokerchain#392).
 *
 * A withdrawal is redeemed on Ethereum with CosmosBridge.withdraw(amount,
 * receiver, nonce, signature), where the signature comes from any validator
 * whose bridge key is whitelisted in the vault. Validators serve one on demand
 * from a read-only query (GET …/withdrawal_signature/{nonce}): nothing is
 * written to chain state, so no transaction is needed. The UI used to wait for
 * a signature to be stored on chain (status "signed") — which no process ever
 * did — so every withdrawal sat at "Awaiting validator signature".
 */

import { ethers } from "ethers";
import type { NetworkEndpoints } from "../context/NetworkContext";

/** The withdrawal a signature must match. `amount` is micro-USDC as a decimal string. */
export interface WithdrawalToSign {
    nonce: string;
    baseAddress: string;
    amount: string;
}

/** A validator's `withdrawal_signature` reply. */
export interface WithdrawalSignatureResponse {
    receiver: string;
    amount: string;
    nonce: string;
    signature: string;
}

/**
 * Nodes to ask, in order: the current network, then the official Block52 node
 * (a validator with a bridge key). Not every node signs — non-validators have
 * no key — and Localhost is never swapped for mainnet.
 */
export function signatureEndpoints(current: NetworkEndpoints, presets: NetworkEndpoints[]): NetworkEndpoints[] {
    const out = [current];
    if (current.name === "Localhost") return out;
    const official = presets.find(n => n.name === "Block52");
    if (official && official.rest !== current.rest) out.push(official);
    return out;
}

/**
 * The digest CosmosBridge recovers the signer from:
 * keccak256(abi.encodePacked(receiver, amount, nonce)) under the EIP-191 prefix.
 * Mirrors pokerchain WithdrawalSigningHash.
 */
export function withdrawalMessageHash(w: WithdrawalToSign): string {
    return ethers.solidityPackedKeccak256(["address", "uint256", "bytes32"], [w.baseAddress, BigInt(w.amount), w.nonce]);
}

/**
 * Checks a validator's reply against the withdrawal before it is used, and
 * returns the 0x signature and the address that signed it. A node can't hand
 * us a signature for a different receiver, amount or nonce: those are checked
 * here, and the signer is recovered from the same digest the contract uses.
 * Whether that signer is whitelisted is the contract's call.
 */
export function verifyWithdrawalSignature(w: WithdrawalToSign, reply: WithdrawalSignatureResponse): { signature: string; signer: string } {
    if (reply.nonce.toLowerCase() !== w.nonce.toLowerCase()) {
        throw new Error(`Signature is for nonce ${reply.nonce}, not ${w.nonce}`);
    }
    if (reply.receiver.toLowerCase() !== w.baseAddress.toLowerCase()) {
        throw new Error(`Signature pays ${reply.receiver}, not ${w.baseAddress}`);
    }
    if (reply.amount !== w.amount) {
        throw new Error(`Signature is for ${reply.amount}, not ${w.amount}`);
    }
    const signer = ethers.verifyMessage(ethers.getBytes(withdrawalMessageHash(w)), reply.signature);
    return { signature: reply.signature, signer };
}

/**
 * A withdrawal error the player can act on. The contract's "nonce already
 * used" means it was paid out already: the chain never learns that, so the
 * request keeps showing as pending.
 */
export function describeWithdrawError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    if (/nonce already used/i.test(message)) {
        return "This withdrawal has already been paid out on Ethereum. Check the receiving wallet.";
    }
    if (/invalid signature/i.test(message)) {
        return "The bridge did not accept the validator's signature. Please contact support.";
    }
    if (/insufficient balance/i.test(message)) {
        return "The bridge doesn't hold enough USDC to pay this right now. Please contact support.";
    }
    if (/user rejected|denied/i.test(message)) {
        return "Transaction rejected in your wallet.";
    }
    return message || "Failed to complete the withdrawal on Ethereum";
}
