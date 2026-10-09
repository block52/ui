import { ethers } from "ethers";
import { assertNftAuthorizationSigner, buildNftAuthorizationMessage, isEthAddress, isNotRegisteredResponse, queryNftAvatar } from "./nftRegistration";

// The exact body node1.block52.xyz returned on 23 Sep 2026 for an address with no avatar.
const NOT_FOUND_500 =
    "{\"code\":2, \"message\":\"failed to query NFT avatar: collections: not found: key 'b521dnsp77pfavsnwnquxlax9scmh28dq3et63tpcr' of type github.com/cosmos/gogoproto/\", \"details\":[]}";

const respond = (status: number, body: string) =>
    Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body), json: () => Promise.resolve(JSON.parse(body)) } as Response);

describe("queryNftAvatar", () => {
    const originalFetch = global.fetch;
    let errorSpy: jest.SpyInstance;
    beforeEach(() => { errorSpy = jest.spyOn(console, "error").mockImplementation(() => {}); });
    afterEach(() => { global.fetch = originalFetch; errorSpy.mockRestore(); });

    it("treats the chain's 500 'collections: not found' as no avatar, without logging an error", async () => {
        global.fetch = jest.fn(() => respond(500, NOT_FOUND_500));
        await expect(queryNftAvatar("https://node", "b521x")).resolves.toBeNull();
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("treats a 404 as no avatar, without logging an error", async () => {
        global.fetch = jest.fn(() => respond(404, "{}"));
        await expect(queryNftAvatar("https://node", "b521x")).resolves.toBeNull();
        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("still logs a genuine server failure", async () => {
        global.fetch = jest.fn(() => respond(500, "{\"code\":13,\"message\":\"internal error\"}"));
        await expect(queryNftAvatar("https://node", "b521x")).resolves.toBeNull();
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it("returns the avatar when one is registered", async () => {
        global.fetch = jest.fn(() => respond(200, JSON.stringify({ eth_address: "0xea36", contract_address: "0xabc", token_id: "7" })));
        await expect(queryNftAvatar("https://node", "b521x")).resolves.toEqual({ cosmosAddress: "b521x", ethAddress: "0xea36", contractAddress: "0xabc", tokenId: "7" });
    });
});

describe("isNotRegisteredResponse", () => {
    it("matches both the wrapped collections error and the intended message", () => {
        expect(isNotRegisteredResponse(NOT_FOUND_500)).toBe(true);
        expect(isNotRegisteredResponse("no NFT avatar registered for address b521x")).toBe(true);
        expect(isNotRegisteredResponse("internal error")).toBe(false);
    });
});

describe("assertNftAuthorizationSigner (ui#733)", () => {
    // Fixed test keys: random wallets need crypto.getRandomValues, which jsdom lacks.
    const owner = new ethers.Wallet("0x" + "11".repeat(32));
    const other = new ethers.Wallet("0x" + "22".repeat(32));
    const message = buildNftAuthorizationMessage(owner.address, "b521me", "0x313e99d23d6a9ed47af8dccd545c2685f21ec44b", "6417");

    it("accepts a signature from the claimed address, in any case", async () => {
        const signature = await owner.signMessage(message);
        expect(() => assertNftAuthorizationSigner(message, signature, owner.address.toLowerCase())).not.toThrow();
    });

    it("names both addresses when the wallet signed with another account", async () => {
        const signature = await other.signMessage(message);
        expect(() => assertNftAuthorizationSigner(message, signature, owner.address)).toThrow(
            `Your wallet signed with ${other.address}, but the avatar is being linked to ${owner.address}.`
        );
    });
});

describe("isEthAddress", () => {
    it("accepts 0x + 40 hex, rejects anything else", () => {
        expect(isEthAddress("0xea36bdfae0280831c1cc6aca0e9e25c7d1ecbaf7")).toBe(true);
        expect(isEthAddress(" 0xEa36BDfaE0280831c1cC6Aca0E9e25C7D1ECbAf7 ")).toBe(true);
        expect(isEthAddress("0xea36")).toBe(false);
        expect(isEthAddress("b521s8aug28r6vned2xm767xhgrkg90wfef2hfg4mg")).toBe(false);
    });
});
