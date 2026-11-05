import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useProfileAvatar } from "../../context/profile/ProfileAvatarContext";
import type { PlayerAward } from "../../utils/playerAwards";
import { truncateMiddle } from "../../utils/stringUtils";
import { AwardCard } from "./AwardCard";

jest.mock("../../context/profile/ProfileAvatarContext", () => ({ useProfileAvatar: jest.fn() }));

const WINNER = "b521hg93rsm2f5v3zlepf20ru88uweajt3nf492s2p";
const RUNNER = "b521kwcmmsp5zhx8e0j9t9zsusvuep2euht3z0vgu9";
const THIRD = "b521dnsp77pfavsnwnquxlax9scmh28dq3et63tpcr";
const WINNER_IMAGE = "https://nft-cdn.alchemy.com/eth-mainnet/winner";
const RUNNER_IMAGE = "https://nft-cdn.alchemy.com/eth-mainnet/runner";

const award: PlayerAward = {
    id: "nit",
    emoji: "🧊",
    title: "Biggest nit",
    measure: "Folds the biggest share of their decisions",
    podium: [
        { address: WINNER, stat: "73%", evidence: "Folds 73% of decisions: 156 of 215" },
        { address: RUNNER, stat: "61%", evidence: "Folds 61% of decisions: 140 of 230" },
        { address: THIRD, stat: "55%", evidence: "Folds 55% of decisions: 120 of 218" }
    ]
};

const mockAvatars = (byAddress: Record<string, string | null>) => {
    const getAvatarForAddress = jest.fn((address?: string) => (address ? (byAddress[address] ?? null) : null));
    (useProfileAvatar as jest.Mock).mockReturnValue({ getAvatarForAddress });
    return getAvatarForAddress;
};

const renderCard = (card: PlayerAward = award) =>
    render(
        <MemoryRouter>
            <AwardCard award={card} />
        </MemoryRouter>
    );

describe("AwardCard registered NFT avatars", () => {
    beforeEach(() => jest.clearAllMocks());

    it("keeps the address-only layout when nobody has a registered avatar", () => {
        mockAvatars({});
        const { container } = renderCard();

        expect(container.querySelector("img")).toBeNull();
        expect(screen.queryByText("NFT")).toBeNull();
        expect(screen.getByRole("link", { name: truncateMiddle(WINNER, 12, 8) })).toHaveAttribute("href", `/players/${WINNER}`);
        expect(screen.getByRole("link", { name: truncateMiddle(RUNNER, 12, 8) })).toHaveAttribute("href", `/players/${RUNNER}`);
        expect(screen.getByText("61%")).toBeInTheDocument();
    });

    it("shows a circle-cropped avatar beside the winner and a runner who registered one", () => {
        const getAvatarForAddress = mockAvatars({
            [WINNER]: WINNER_IMAGE,
            [RUNNER]: RUNNER_IMAGE,
            [THIRD]: null
        });
        const { container } = renderCard();

        const images = container.querySelectorAll("img");
        expect(images).toHaveLength(2);
        expect(images[0]).toHaveAttribute("src", WINNER_IMAGE);
        expect(images[0].className).toContain("avatarImage");
        expect(images[0].parentElement?.className).toContain("avatarWinner");
        expect(images[1]).toHaveAttribute("src", RUNNER_IMAGE);
        expect(images[1].parentElement?.className).toContain("avatarRunner");
        expect(screen.getByRole("link", { name: truncateMiddle(THIRD, 12, 8) }).querySelector("img")).toBeNull();
        expect(getAvatarForAddress).toHaveBeenCalledWith(WINNER);
        expect(getAvatarForAddress).toHaveBeenCalledWith(RUNNER);
        expect(getAvatarForAddress).toHaveBeenCalledWith(THIRD);
    });

    it("drops a circle whose image fails and leaves that address on its own", () => {
        mockAvatars({ [WINNER]: WINNER_IMAGE, [RUNNER]: null, [THIRD]: null });
        const { container } = renderCard();

        fireEvent.error(container.querySelector("img")!);

        expect(container.querySelector("img")).toBeNull();
        expect(screen.queryByText("NFT")).toBeNull();
        expect(screen.getByRole("link", { name: truncateMiddle(WINNER, 12, 8) })).toBeInTheDocument();
        expect(screen.getByText(award.podium[0].evidence)).toBeInTheDocument();
    });

    it("renders a winner with no runners-up", () => {
        mockAvatars({ [WINNER]: WINNER_IMAGE });
        const { container } = renderCard({ ...award, podium: [award.podium[0]] });

        expect(container.querySelectorAll("img")).toHaveLength(1);
        expect(screen.queryByRole("list")).toBeNull();
    });
});
