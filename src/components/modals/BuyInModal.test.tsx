import { render, screen } from "@testing-library/react";

jest.mock("../common/Modal", () => ({
    Modal: ({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) => (
        <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
            {children}
        </div>
    )
}));
jest.mock("../ui", () => ({
    PillButton: ({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...rest}>{children}</button>
}));
jest.mock("./DepositCore", () => ({ __esModule: true, default: () => <div>deposit-core</div> }));
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }));
jest.mock("../../hooks", () => ({
    useCosmosWallet: () => ({ isLoading: false, error: null, address: "b521x", balance: [{ denom: "usdc", amount: "500000000" }] })
}));
jest.mock("../../hooks/game/useMinAndMaxBuyIns", () => ({ useMinAndMaxBuyIns: () => ({ minBuyIn: undefined, maxBuyIn: undefined }) }));
jest.mock("../../hooks/game/useVacantSeatData", () => ({ useVacantSeatData: () => ({ emptySeatIndexes: [1, 2], isUserAlreadyPlaying: false }) }));
jest.mock("../../hooks/playerActions/joinTable", () => ({ joinTable: jest.fn() }));
jest.mock("../../context/NetworkContext", () => ({ useNetwork: () => ({ currentNetwork: {} }) }));
jest.mock("../../context/GameStateContext", () => ({
    useGameStateContext: () => ({ gameState: { gameOptions: { smallBlind: "10000", bigBlind: "20000" } } })
}));

// eslint-disable-next-line import/first
import BuyInModal from "./BuyInModal";

describe("BuyInModal", () => {
    it("renders a cash game with presets within [min, max] and the primary action", () => {
        render(<BuyInModal onClose={jest.fn()} onJoin={jest.fn()} minBuyIn="400000" maxBuyIn="2000000" />);
        expect(screen.getByText("Cash Game Buy-In")).toBeTruthy();
        expect(screen.getByText("Cash game · $0.01 / $0.02 blinds")).toBeTruthy();
        expect(screen.getByLabelText("Buy-In Amount")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Min" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Max" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Take My Seat" })).toBeTruthy();
    });

    it("shows the inline deposit flow when the balance is below the minimum", () => {
        render(<BuyInModal onClose={jest.fn()} onJoin={jest.fn()} minBuyIn="900000000" maxBuyIn="2000000000" />);
        expect(screen.getByText("deposit-core")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Take My Seat" })).toBeNull();
    });
});
