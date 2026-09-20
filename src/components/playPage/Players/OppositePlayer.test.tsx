import { render, screen } from "@testing-library/react";
import OppositePlayer from "./OppositePlayer";
import { useHoleCardDealContext } from "../../../context/HoleCardDealContext";
import { usePlayerData } from "../../../hooks/player/usePlayerData";
import type { HoleCardDealState } from "../../../hooks/animations/useHoleCardDeal";

jest.mock("react-router-dom", () => ({ useParams: () => ({ id: "table-1" }) }));
jest.mock("../common/Badge", () => ({ __esModule: true, default: () => <div data-testid="badge" /> }));
jest.mock("../../../hooks/game/useWinnerInfo", () => ({ useWinnerInfo: () => ({ winnerInfo: [], winnerBySeat: new Map() }) }));
jest.mock("../../../hooks/game/useWinnerCards", () => ({ useWinnerCards: () => new Set() }));
jest.mock("../../../hooks/player/useShowingCardsByAddress", () => ({ useShowingCardsByAddress: () => ({ showingPlayers: [] }) }));
jest.mock("../../../hooks/game/useDealerPosition", () => ({ useDealerPosition: () => ({ dealerSeat: 1 }) }));
jest.mock("../../../hooks/game/useSitAndGoPlayerResults", () => ({ useSitAndGoPlayerResults: () => ({ getSeatResult: () => null, isSitAndGo: false }) }));
jest.mock("../../../hooks/player/useAllInEquity", () => ({ useAllInEquity: () => ({ equities: new Map(), shouldShow: false }) }));
jest.mock("../../../context/profile/ProfileAvatarContext", () => ({ useProfileAvatar: () => ({ getAvatarForAddress: () => undefined }) }));
jest.mock("../../../hooks/player/usePlayerTimer", () => ({ usePlayerTimer: () => ({ isActive: false }) }));
jest.mock("../../../hooks/player/usePlayerData");
jest.mock("../../../context/HoleCardDealContext");

const mockUsePlayerData = usePlayerData as jest.MockedFunction<typeof usePlayerData>;
const mockUseHoleCardDealContext = useHoleCardDealContext as jest.MockedFunction<typeof useHoleCardDealContext>;

function setPlayer(over: Partial<ReturnType<typeof usePlayerData>> = {}) {
    mockUsePlayerData.mockReturnValue({
        playerData: { address: "b52opp", seat: 3, stack: "1000", status: "active" },
        stackValue: 1000,
        isFolded: false,
        isAllIn: false,
        isSeated: true,
        isSittingOut: false,
        holeCards: ["X", "X"],
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

const renderSeat = () => render(<OppositePlayer index={3} currentIndex={1} left="10px" top="20px" cardBackStyle="default" />);

describe("OppositePlayer hole cards (ui#21 gating)", () => {
    it("shows two card backs once the seat has been dealt", () => {
        setPlayer();
        setDeal();
        renderSeat();
        expect(screen.getAllByAltText("Opposite Player Card")).toHaveLength(2);
    });

    it("holds the placeholder while the seat's cards are still in flight", () => {
        setPlayer();
        setDeal({ isDealing: true, pendingSeats: new Set([3]), isDealt: seat => seat !== 3 });
        renderSeat();
        expect(screen.queryByAltText("Opposite Player Card")).toBeNull();
    });

    it("only gates its own seat", () => {
        setPlayer();
        setDeal({ isDealing: true, pendingSeats: new Set([5]), isDealt: seat => seat !== 5 });
        renderSeat();
        expect(screen.getAllByAltText("Opposite Player Card")).toHaveLength(2);
    });

    it("still shows nothing for a folded seat or one without cards", () => {
        setDeal();
        setPlayer({ isFolded: true });
        const { unmount } = renderSeat();
        expect(screen.queryByAltText("Opposite Player Card")).toBeNull();
        unmount();

        setPlayer({ holeCards: [] });
        renderSeat();
        expect(screen.queryByAltText("Opposite Player Card")).toBeNull();
    });
});
