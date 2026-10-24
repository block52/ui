import React from "react";
import { render, screen } from "@testing-library/react";
import { PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { MainActionButtons } from "./MainActionButtons";
import type { MainActionButtonsProps } from "./types";

// The shared common barrel pulls in modules that read import.meta (not parseable
// under jest); only the spinner is used here.
jest.mock("../common", () => ({ LoadingSpinner: () => <span>…</span> }));

const renderButtons = (over: Partial<MainActionButtonsProps> = {}) => {
    const props: MainActionButtonsProps = {
        canFold: true,
        canCheck: true,
        canCall: false,
        callAmount: "$0.00",
        canBet: true,
        canRaise: false,
        raiseAmount: 0.02,
        isRaiseAmountInvalid: false,
        playerStatus: PlayerStatus.ACTIVE,
        loading: null,
        isMobileLandscape: false,
        currentRound: TexasHoldemRound.FLOP,
        previousActions: [],
        userAddress: "b521me",
        isAllIn: false,
        isTournament: false,
        callIsAllIn: false,
        canAllIn: false,
        allInAmount: "$1.99",
        onFold: jest.fn(),
        onCheck: jest.fn(),
        onCall: jest.fn(),
        onBetOrRaise: jest.fn(),
        onAllIn: jest.fn(),
        ...over
    };
    render(<MainActionButtons {...props} />);
};

describe("MainActionButtons — bet/raise rules (ui#890)", () => {
    it("a BET outside min/max is disabled (not just a RAISE)", () => {
        renderButtons({ isRaiseAmountInvalid: true });
        expect(screen.getByRole("button", { name: /^BET/ })).toBeDisabled();
    });

    it("a valid BET is enabled", () => {
        renderButtons();
        expect(screen.getByRole("button", { name: /^BET/ })).toBeEnabled();
    });

    it("a RAISE outside min/max is disabled", () => {
        renderButtons({ canBet: false, canRaise: true, isRaiseAmountInvalid: true });
        expect(screen.getByRole("button", { name: /^RAISE TO/ })).toBeDisabled();
    });

    it("at the whole stack the button reads ALL-IN and stays enabled to confirm", () => {
        renderButtons({ raiseAmount: 1.99, isAllIn: true });
        const btn = screen.getByRole("button", { name: /^ALL-IN/ });
        expect(btn).toHaveTextContent("ALL-IN $1.99");
        expect(btn).toBeEnabled();
    });
});
