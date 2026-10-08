import { describeWithdrawError, signatureEndpoints, verifyWithdrawalSignature, type WithdrawalToSign } from "./withdrawalSignature";
import type { NetworkEndpoints } from "../context/NetworkContext";

// A real reply: node1.block52.xyz's signature for withdrawal nonce 3 (pokerchain#392),
// fetched 2026-10-08. eth_call of CosmosBridge.withdraw with it succeeds on mainnet.
const NONCE_3: WithdrawalToSign = {
    nonce: "0x0000000000000000000000000000000000000000000000000000000000000003",
    baseAddress: "0xbfb5AB2F348dDE652322b6e508850675581998F1",
    amount: "114000000"
};
const REPLY_3 = {
    receiver: "0xbfb5AB2F348dDE652322b6e508850675581998F1",
    amount: "114000000",
    nonce: "0x0000000000000000000000000000000000000000000000000000000000000003",
    signature:
        "0x817fed321b9f00df081832a4008316be5bc2af7dab02dc73c9fdf18da5f326952cbbf54dd5f2a899e08dff6f1c815a813933717d620f810fe5481e6d671084ec1b"
};
// The whitelisted bridge signer node1 reports (WhiteListVault.isValidator = true).
const NODE1_SIGNER = "0xD1a080d671fD84A117c8261b5E328dE04FCd7FD9";

describe("verifyWithdrawalSignature (pokerchain#392)", () => {
    it("recovers the validator's key from a real signature, using the contract's digest", () => {
        const { signature, signer } = verifyWithdrawalSignature(NONCE_3, REPLY_3);
        expect(signature).toBe(REPLY_3.signature);
        expect(signer).toBe(NODE1_SIGNER);
    });

    it("matches the receiver in any case", () => {
        expect(() => verifyWithdrawalSignature({ ...NONCE_3, baseAddress: NONCE_3.baseAddress.toLowerCase() }, REPLY_3)).not.toThrow();
    });

    it("rejects a reply for another receiver, amount or nonce", () => {
        expect(() => verifyWithdrawalSignature(NONCE_3, { ...REPLY_3, receiver: "0x0000000000000000000000000000000000000001" })).toThrow(
            "Signature pays"
        );
        expect(() => verifyWithdrawalSignature(NONCE_3, { ...REPLY_3, amount: "1" })).toThrow("Signature is for 1");
        expect(() => verifyWithdrawalSignature(NONCE_3, { ...REPLY_3, nonce: "0x01" })).toThrow("Signature is for nonce");
    });

    it("recovers a different signer if the withdrawal doesn't match what was signed", () => {
        const other = { ...NONCE_3, amount: "115000000" };
        const { signer } = verifyWithdrawalSignature(other, { ...REPLY_3, amount: "115000000" });
        expect(signer).not.toBe(NODE1_SIGNER);
    });
});

describe("signatureEndpoints", () => {
    const official = { name: "Block52", rest: "https://node1.block52.xyz" } as NetworkEndpoints;
    const hodl = { name: "Texas Hodl", rest: "https://node.texashodl.net" } as NetworkEndpoints;
    const local = { name: "Localhost", rest: "http://localhost:1317" } as NetworkEndpoints;

    it("asks the current network, then the official validator", () => {
        expect(signatureEndpoints(hodl, [official, hodl, local])).toEqual([hodl, official]);
    });

    it("doesn't ask the official node twice, or swap Localhost for mainnet", () => {
        expect(signatureEndpoints(official, [official, hodl])).toEqual([official]);
        expect(signatureEndpoints(local, [official, local])).toEqual([local]);
    });
});

describe("describeWithdrawError", () => {
    it("explains a nonce the bridge already paid", () => {
        expect(describeWithdrawError(new Error('execution reverted: "withdraw: nonce already used"'))).toBe(
            "This withdrawal has already been paid out on Ethereum. Check the receiving wallet."
        );
    });

    it("explains an unwhitelisted signer, an empty bridge and a rejection", () => {
        expect(describeWithdrawError(new Error("withdraw: invalid signature"))).toContain("did not accept");
        expect(describeWithdrawError(new Error("withdraw: insufficient balance"))).toContain("enough USDC");
        expect(describeWithdrawError(new Error("User rejected the request."))).toBe("Transaction rejected in your wallet.");
    });

    it("passes anything else through", () => {
        expect(describeWithdrawError(new Error("boom"))).toBe("boom");
    });
});
