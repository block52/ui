import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NftAvatarImage } from "./NftAvatarImage";
import { IPFS_GATEWAYS } from "../../utils/profile/ipfs";

const CID = "QmcvgYozTdNmVskxdMzoXvGQuCCejnLRiExampleExampleCid";

const renderAvatar = (src: string) =>
    render(<NftAvatarImage src={src} alt="Player avatar" imgClassName="img" chipClassName="chip" fallbackClassName="fallback" />);

describe("NftAvatarImage IPFS fallback chain (#625)", () => {
    it("starts on the first gateway for an ipfs ref", () => {
        renderAvatar(`ipfs://${CID}/390`);
        expect(screen.getByAltText("Player avatar")).toHaveAttribute("src", `${IPFS_GATEWAYS[0]}/ipfs/${CID}/390`);
    });

    it("steps to the next gateway when one errors, before giving up", () => {
        renderAvatar(`ipfs://${CID}/390`);
        const img = () => screen.queryByAltText("Player avatar");

        // First gateway 403s → step to the second.
        fireEvent.error(img()!);
        expect(img()).toHaveAttribute("src", `${IPFS_GATEWAYS[1]}/ipfs/${CID}/390`);
    });

    it("shows the NFT placeholder only after every gateway has failed", () => {
        renderAvatar(`ipfs://${CID}/390`);
        // Exhaust all gateways.
        for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
            const img = screen.queryByAltText("Player avatar");
            expect(img).not.toBeNull();
            fireEvent.error(img!);
        }
        expect(screen.queryByAltText("Player avatar")).toBeNull();
        expect(screen.getByText("NFT")).toBeInTheDocument();
    });

    it("a non-IPFS CDN URL is tried once, then falls back to the NFT chip", () => {
        const cdn = "https://nft2-cdn.alchemy.com/eth-mainnet/abc123";
        renderAvatar(cdn);
        const img = screen.getByAltText("Player avatar");
        expect(img).toHaveAttribute("src", cdn);
        fireEvent.error(img);
        expect(screen.getByText("NFT")).toBeInTheDocument();
    });
});
