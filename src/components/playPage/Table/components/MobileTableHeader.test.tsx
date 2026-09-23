/**
 * MobileTableHeader drawer rows (ui#684).
 *
 * The phone drawer is now the only home for three controls that used to be
 * pinned over the felt: the spectate hint, the 6-o'clock view preference, and
 * the two sit-out intents. These assert they are present, wired, and gated —
 * the felt side is asserted by PlayerActionButtons' own tests.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NonPlayerActionType, type LegalActionDTO } from "@block52/poker-vm-sdk";
import { MobileTableHeader } from "./MobileTableHeader";
import { SitOutIntentProvider } from "../../../../context/SitOutIntentContext";

const mockSubmit = jest.fn();
const mockToggleSeatAtBottom = jest.fn();

jest.mock("../../../../context/ActionSubmitContext", () => ({
    useActionSubmit: () => ({ submit: mockSubmit, loadingAction: null, isBusy: false, lastError: null })
}));
jest.mock("../../../../context/GameStateContext", () => ({
    useGameStateContext: () => ({ gameState: { players: [], bigBlindPosition: 2 }, gameFormat: "cash" })
}));
jest.mock("../../../../context/GameSettingsContext", () => ({
    useGameSettings: () => ({ seatAtBottom: false, toggleSeatAtBottom: mockToggleSeatAtBottom })
}));
jest.mock("../../../../hooks/game/useBlindLevel", () => ({
    useBlindLevel: () => ({ isActive: false, level: undefined, msRemaining: 0 })
}));
jest.mock("../../../../hooks/game/useTableTopUp", () => ({
    useTableTopUp: () => ({ handleTopUp: jest.fn(), isTopUpLoading: false })
}));
// Modal pulls colorConfig, which reads import.meta.env — unavailable under Jest.
jest.mock("../../../common/Modal", () => ({ Modal: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }));
jest.mock("../../../NetworkSelector", () => ({ NetworkSelector: () => <div /> }));
jest.mock("../../../profile", () => ({ ProfileAvatarButton: () => <div /> }));
jest.mock("../../../modals", () => ({ TopUpModal: () => <div /> }));

const sitOutLegal: LegalActionDTO[] = [{ action: NonPlayerActionType.SIT_OUT, min: "0", max: "0", index: 1 } as LegalActionDTO];

function renderHeader(over: { seated?: boolean; legalActions?: LegalActionDTO[] } = {}) {
    const legalActions = over.legalActions ?? [];
    return render(
        <SitOutIntentProvider tableId="0xtable" network={{} as never} pendingSitOut={null} legalActions={legalActions}>
            <MobileTableHeader
                tableId="0xtable"
                currentNetwork={{} as never}
                gameFormat={null}
                gameOptions={null}
                tableActivePlayers={[]}
                publicKey="b521abc"
                formattedAddress="b521...abc"
                isBalanceLoading={false}
                balanceFormatted="0.00"
                formattedValues={{ smallBlindFormatted: "$10", bigBlindFormatted: "$20", isTournamentStyle: false }}
                handNumber={1}
                nextToAct={-1}
                currentPlayerData={over.seated ? ({ seat: 1 } as never) : null}
                isCurrentUserSeated={!!over.seated}
                legalActions={legalActions}
                currentStack="0"
                minBuyIn="0"
                maxBuyIn="0"
                walletBalance="0"
                openSidebar={false}
                openSettings={false}
                tableStyle="modern"
                onCycleTableStyle={jest.fn()}
                handleLobbyClick={jest.fn()}
                handleCopyTableLink={jest.fn()}
                fetchAccountBalance={jest.fn()}
                copyToClipboard={jest.fn()}
                onCloseSideBar={jest.fn()}
                onToggleSettings={jest.fn()}
                handleLeaveTableClick={jest.fn()}
                handleShareHand={jest.fn()}
            />
        </SitOutIntentProvider>
    );
}

const openMenu = () => fireEvent.click(screen.getByLabelText("Open menu"));

describe("MobileTableHeader drawer (ui#684)", () => {
    beforeEach(() => jest.clearAllMocks());

    it("offers the 6 o'clock view preference, seated or not", () => {
        renderHeader();
        openMenu();
        const row = screen.getByRole("switch", { name: /Seat me at 6/ });
        fireEvent.click(row);
        expect(mockToggleSeatAtBottom).toHaveBeenCalledTimes(1);
    });

    it("shows the spectate hint while unseated", () => {
        renderHeader({ seated: false });
        openMenu();
        expect(screen.getByText(/tap an open seat to join/)).toBeInTheDocument();
    });

    it("hides the spectate hint once seated", () => {
        renderHeader({ seated: true, legalActions: sitOutLegal });
        openMenu();
        expect(screen.queryByText(/tap an open seat to join/)).not.toBeInTheDocument();
    });

    describe("sit-out intents", () => {
        it("are absent when the engine does not allow sitting out", () => {
            renderHeader({ seated: true, legalActions: [] });
            openMenu();
            expect(screen.queryByRole("switch", { name: /Next hand/ })).not.toBeInTheDocument();
            expect(screen.queryByRole("switch", { name: /Next big blind/ })).not.toBeInTheDocument();
        });

        it("submit a sit-out for 'next hand'", () => {
            renderHeader({ seated: true, legalActions: sitOutLegal });
            openMenu();
            fireEvent.click(screen.getByRole("switch", { name: /Next hand/ }));
            expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ actionName: "sit-out" }));
        });

        it("queue 'next big blind' locally, with no transaction (#114)", () => {
            renderHeader({ seated: true, legalActions: sitOutLegal });
            openMenu();
            const row = screen.getByRole("switch", { name: /Next big blind/ });
            expect(row).toHaveAttribute("aria-checked", "false");
            fireEvent.click(row);
            expect(screen.getByRole("switch", { name: /Next big blind/ })).toHaveAttribute("aria-checked", "true");
            expect(mockSubmit).not.toHaveBeenCalled();
        });
    });
});
