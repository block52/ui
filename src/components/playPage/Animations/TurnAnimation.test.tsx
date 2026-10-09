/**
 * TurnAnimation (ui#721).
 *
 * The pulsing "whose turn" ring must never render during a hand replay: a
 * replay is a frozen snapshot, so there is no live next-to-act. Before the fix
 * it flashed forever on whichever seat the snapshot left as next-to-act.
 */
import { render } from "@testing-library/react";
import TurnAnimation from "./TurnAnimation";

const mockUseReplay = jest.fn();
const mockUseNextToActInfo = jest.fn();
jest.mock("../../../context/gameState/ReplayContext", () => ({
    useReplay: () => mockUseReplay()
}));
jest.mock("../../../hooks/game/useNextToActInfo", () => ({
    useNextToActInfo: () => mockUseNextToActInfo()
}));

const POSITION = { left: "10px", top: "20px" };

describe("TurnAnimation replay gate (ui#721)", () => {
    beforeEach(() => jest.clearAllMocks());

    it("renders the turn ring when it is this seat's turn and not in replay", () => {
        mockUseReplay.mockReturnValue({ isReplayMode: false });
        mockUseNextToActInfo.mockReturnValue({ seat: 1 }); // seat 1 === index 0 + 1
        const { container } = render(<TurnAnimation index={0} position={POSITION} />);
        expect(container.querySelector(".turn-animation-container")).not.toBeNull();
    });

    it("renders nothing in replay even when the snapshot marks this seat next-to-act", () => {
        mockUseReplay.mockReturnValue({ isReplayMode: true });
        mockUseNextToActInfo.mockReturnValue({ seat: 1 });
        const { container } = render(<TurnAnimation index={0} position={POSITION} />);
        expect(container.querySelector(".turn-animation-container")).toBeNull();
    });
});
