import { render, screen } from "@testing-library/react";
import Player from "./Player";
import { useHoleCardDealContext } from "../../../context/HoleCardDealContext";
import { usePlayerData } from "../../../hooks/player/usePlayerData";
import { getCardImageUrl, getCardBackUrl } from "../../../utils/cardImages";
import type { HoleCardDealState } from "../../../hooks/animations/useHoleCardDeal";

jest.mock("react-router-dom", () => ({ useParams: () => ({ id: "table-1" }) }));
jest.mock("../common/Badge", () => ({ __esModule: true, default: () => <div data-testid="badge" /> }));
jest.mock("../../../hooks/game/useWinnerInfo", () => ({ useWinnerInfo: () => ({ winnerInfo: [], winnerBySeat: new Map() }) }));
jest.mock("../../../hooks/game/useWinnerCards", () => ({ useWinnerCards: () => new Set() }));
jest.mock("../../../hooks/player/usePlayerTimer", () => ({
    usePlayerTimer: () => ({ extendTime: undefined, canExtend: false, isCurrentUserTurn: false, isActive: false })
}));
jest.mock("../../../context/GameStateContext", () => ({ useGameStateContext: () => ({ gameState: { players: [] } }) }));
jest.mock("../../../hooks/game/useDealerPosition", () => ({ useDealerPosition: () => ({ dealerSeat: 1 }) }));
jest.mock("../../../hooks/game/useSitAndGoPlayerResults", () => ({ useSitAndGoPlayerResults: () => ({ getSeatResult: () => null, isSitAndGo: false }) }));
jest.mock("../../../hooks/player/useAllInEquity", () => ({ useAllInEquity: () => ({ equities: new Map(), shouldShow: false }) }));
jest.mock("../../../context/profile/ProfileAvatarContext", () => ({ useProfileAvatar: () => ({ getAvatarForAddress: () => undefined }) }));
jest.mock("../../../context/NetworkContext", () => ({ useNetwork: () => ({ currentNetwork: {} }) }));
jest.mock("../../../context/ActionSubmitContext", () => ({ useActionSubmit: () => ({ submit: jest.fn() }) }));
jest.mock("../../../hooks/playerActions", () => ({ sitIn: jest.fn(), SIT_IN_METHOD_POST_NOW: "post-now" }));
jest.mock("../../../hooks/player/usePlayerData");
jest.mock("../../../context/HoleCardDealContext");

const mockUsePlayerData = usePlayerData as jest.MockedFunction<typeof usePlayerData>;
const mockUseHoleCardDealContext = useHoleCardDealContext as jest.MockedFunction<typeof useHoleCardDealContext>;

function setPlayer(over: Partial<ReturnType<typeof usePlayerData>> = {}) {
    mockUsePlayerData.mockReturnValue({
        playerData: { address: "b52me", seat: 1, stack: "1000", status: "active" },
        stackValue: 1000,
        isFolded: false,
        isAllIn: false,
        isSeated: true,
        isSittingOut: false,
        holeCards: ["AH", "KD"],
        round: "preflop",
        ...over
    } as ReturnType<typeof usePlayerData>);
}

function setDeal(over: Partial<HoleCardDealState> = {}) {
    mockUseHoleCardDealContext.mockReturnValue({
        flights: [],
        landedCount: 0,
        pendingSeats: new Set<number>(),
        viewerRevealed: true,
        isDealing: false,
        isDealt: () => true,
        ...over
    });
}

const renderSeat = () => render(<Player index={1} currentIndex={1} left="10px" top="20px" cardBackStyle="default" />);

describe("Player hole cards (ui#21 deal + flip)", () => {
    it("renders both cards face-up (already flipped) outside a deal", () => {
        setPlayer();
        setDeal();
        renderSeat();
        const cards = screen.getAllByTestId("hole-card");
        expect(cards).toHaveLength(2);
        for (const card of cards) {
            expect(card.className).toContain("flipped");
        }
        expect(screen.getByAltText("Your card 1")).toHaveAttribute("src", getCardImageUrl("AH"));
        expect(screen.getByAltText("Your card 2")).toHaveAttribute("src", getCardImageUrl("KD"));
    });

    it("holds the placeholder while its cards are in flight", () => {
        setPlayer();
        setDeal({ isDealing: true, viewerRevealed: false, pendingSeats: new Set([1]), isDealt: seat => seat !== 1 });
        renderSeat();
        expect(screen.queryByTestId("hole-card")).toBeNull();
    });

    it("shows the backs, unflipped, once landed but before the deal has finished", () => {
        setPlayer();
        setDeal({ isDealing: true, viewerRevealed: false, pendingSeats: new Set([5]), isDealt: seat => seat !== 5 });
        renderSeat();
        const cards = screen.getAllByTestId("hole-card");
        expect(cards).toHaveLength(2);
        for (const card of cards) {
            expect(card.className).not.toContain("flipped");
            const back = card.querySelector<HTMLImageElement>(".handcard-front img")!;
            expect(back.src).toContain(getCardBackUrl("default"));
        }
    });

    it("shows the placeholder without cards", () => {
        setPlayer({ holeCards: [] });
        setDeal();
        renderSeat();
        expect(screen.queryByTestId("hole-card")).toBeNull();
    });
});
