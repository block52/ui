import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProfileAvatarModal } from "./ProfileAvatarModal";
import { useProfileAvatar } from "../../context/profile/ProfileAvatarContext";

jest.mock("../../context/profile/ProfileAvatarContext", () => ({ useProfileAvatar: jest.fn() }));
jest.mock("react-toastify", () => ({ toast: { success: jest.fn() } }));
// The real Modal pulls in colorConfig, which reads import.meta.env (Jest cannot parse it).
jest.mock("../common/Modal", () => ({ Modal: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }));

const LINKED = "0xea36bdfae0280831c1cc6aca0e9e25c7d1ecbaf7";
const nft = { id: "0x313e:6417", contractAddress: "0x313e99d23d6a9ed47af8dccd545c2685f21ec44b", tokenId: "6417", imageUrl: "https://cdn/x.png", collectionName: "The Del Mundos" };

const base: Record<string, unknown> = {
    isDrawerOpen: true,
    closeDrawer: jest.fn(),
    isWalletConnected: false,
    walletAddress: undefined,
    linkedEthAddress: LINKED,
    viewAddress: LINKED,
    setBrowseAddress: jest.fn(),
    openConnectModal: jest.fn(),
    walletNfts: [nft],
    isLoadingNfts: false,
    nftsError: null,
    nftsWarning: null,
    selectedAvatar: null,
    selectAvatar: jest.fn(),
    clearAvatar: jest.fn(),
    refreshWalletNfts: jest.fn(),
    disconnectWallet: jest.fn(),
    hasSourceConfigured: true,
    isRegistering: false,
    registrationError: null
};

const renderWith = (overrides: Record<string, unknown> = {}) => {
    const ctx = { ...base, ...overrides } as Record<string, jest.Mock>;
    (useProfileAvatar as jest.Mock).mockReturnValue(ctx);
    render(<ProfileAvatarModal />);
    return ctx;
};

describe("ProfileAvatarModal (ui#733)", () => {
    beforeEach(() => jest.clearAllMocks());

    it("lists the linked wallet's NFTs without a connected wallet", () => {
        renderWith();
        expect(screen.getByAltText("NFT #6417")).toBeInTheDocument();
        expect(screen.getByText(/Showing the NFTs of the wallet linked to your Block52 account/)).toBeInTheDocument();
        expect((screen.getByLabelText("Wallet") as HTMLInputElement).value).toBe(LINKED);
    });

    it("asks to connect, instead of registering, when an NFT is picked without a wallet", () => {
        const ctx = renderWith();
        fireEvent.click(screen.getByTitle("Connect this wallet to use it as your avatar"));
        expect(ctx.openConnectModal).toHaveBeenCalled();
        expect(ctx.selectAvatar).not.toHaveBeenCalled();
    });

    it("registers the picked NFT when the wallet is connected", () => {
        const ctx = renderWith({ isWalletConnected: true, walletAddress: LINKED });
        fireEvent.click(screen.getByTitle("Use as my avatar"));
        expect(ctx.selectAvatar).toHaveBeenCalledWith(nft);
        expect(screen.queryByText(/Connect that wallet/)).not.toBeInTheDocument();
    });

    it("browses a typed address, and rejects one that isn't an Ethereum address", () => {
        const ctx = renderWith({ linkedEthAddress: null, viewAddress: null, walletNfts: [] });
        expect(screen.getByText(/Enter an Ethereum address to see its NFTs/)).toBeInTheDocument();

        const input = screen.getByLabelText("Wallet");
        fireEvent.change(input, { target: { value: "b521notanethaddress" } });
        fireEvent.click(screen.getByText("View"));
        expect(screen.getByText(/Enter an Ethereum address \(0x followed by 40 hex characters\)/)).toBeInTheDocument();
        expect(ctx.setBrowseAddress).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: LINKED } });
        fireEvent.click(screen.getByText("View"));
        expect(ctx.setBrowseAddress).toHaveBeenCalledWith(LINKED);
    });
});
