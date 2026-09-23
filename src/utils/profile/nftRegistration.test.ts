import { isNotRegisteredResponse, queryNftAvatar } from "./nftRegistration";

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
        global.fetch = jest.fn(() => respond(200, JSON.stringify({ contract_address: "0xabc", token_id: "7" })));
        await expect(queryNftAvatar("https://node", "b521x")).resolves.toEqual({ cosmosAddress: "b521x", contractAddress: "0xabc", tokenId: "7" });
    });
});

describe("isNotRegisteredResponse", () => {
    it("matches both the wrapped collections error and the intended message", () => {
        expect(isNotRegisteredResponse(NOT_FOUND_500)).toBe(true);
        expect(isNotRegisteredResponse("no NFT avatar registered for address b521x")).toBe(true);
        expect(isNotRegisteredResponse("internal error")).toBe(false);
    });
});
