/**
 * Tests for the seat avatar's gateway fallback chain (ui#625).
 *
 * The 2026-09-20 session: `ipfs.io` answered 403 and every seat dropped
 * straight to the "NFT" text chip, because one failing gateway was the whole
 * of our resolution strategy. The chip is now the LAST resort, not the first.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { PlayerAvatar } from "./PlayerAvatar";

const CID = "QmcvgYozTdNmVskxdMzoXvGQuCCejnLRiabcdefghijklmn";

describe("PlayerAvatar", () => {
    const original = process.env.VITE_IPFS_GATEWAYS;

    beforeEach(() => {
        process.env.VITE_IPFS_GATEWAYS = "https://first.example/ipfs/,https://second.example/ipfs/";
    });

    afterEach(() => {
        if (original === undefined) {
            delete process.env.VITE_IPFS_GATEWAYS;
        } else {
            process.env.VITE_IPFS_GATEWAYS = original;
        }
    });

    const avatar = () => screen.getByAltText("Player avatar") as HTMLImageElement;

    it("starts at the highest-priority gateway", () => {
        render(<PlayerAvatar src={`ipfs://${CID}/390`} />);
        expect(avatar().src).toBe(`https://first.example/ipfs/${CID}/390`);
    });

    it("steps to the next gateway when one refuses the image", () => {
        render(<PlayerAvatar src={`ipfs://${CID}/390`} />);

        fireEvent.error(avatar());

        expect(avatar().src).toBe(`https://second.example/ipfs/${CID}/390`);
        expect(screen.queryByText("NFT")).not.toBeInTheDocument();
    });

    it("shows the NFT chip only once every gateway has refused", () => {
        render(<PlayerAvatar src={`ipfs://${CID}/390`} />);

        fireEvent.error(avatar());
        fireEvent.error(avatar());

        expect(screen.queryByAltText("Player avatar")).not.toBeInTheDocument();
        expect(screen.getByText("NFT")).toBeInTheDocument();
    });

    it("gives an already-registered ipfs.io avatar the same fallback chain", () => {
        render(<PlayerAvatar src={`https://ipfs.io/ipfs/${CID}/390`} />);

        expect(avatar().src).toBe(`https://first.example/ipfs/${CID}/390`);
        fireEvent.error(avatar());
        expect(avatar().src).toBe(`https://second.example/ipfs/${CID}/390`);
    });

    it("falls straight to the chip for a non-IPFS image that fails — there is nowhere else to look", () => {
        render(<PlayerAvatar src="https://cdn.example/a.png" />);

        expect(avatar().src).toBe("https://cdn.example/a.png");
        fireEvent.error(avatar());
        expect(screen.getByText("NFT")).toBeInTheDocument();
    });

    it("restarts the chain when the seat's avatar changes", () => {
        const { rerender } = render(<PlayerAvatar src={`ipfs://${CID}/390`} />);
        fireEvent.error(avatar());
        fireEvent.error(avatar());
        expect(screen.getByText("NFT")).toBeInTheDocument();

        rerender(<PlayerAvatar src={`ipfs://${CID}/391`} />);

        expect(avatar().src).toBe(`https://first.example/ipfs/${CID}/391`);
        expect(screen.queryByText("NFT")).not.toBeInTheDocument();
    });

    it("renders nothing when the seat has no avatar", () => {
        const { container } = render(<PlayerAvatar src={null} />);
        expect(container).toBeEmptyDOMElement();
    });
});
