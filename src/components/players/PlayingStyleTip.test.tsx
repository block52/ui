import { fireEvent, render, screen } from "@testing-library/react";
import { PlayingStyleTip } from "./PlayingStyleTip";
import { PLAYING_STYLE_FIGURES } from "../../utils/playingStyle";

const vpip = PLAYING_STYLE_FIGURES[0];

function media(fine: boolean) {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: fine && query.includes("hover"),
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
    }));
}

describe("PlayingStyleTip", () => {
    const original = window.matchMedia;

    afterEach(() => {
        window.matchMedia = original;
    });

    it("toggles the explanation on a tap, and closes it from Escape or a tap outside", () => {
        media(false);
        render(<PlayingStyleTip figure={vpip} />);
        const button = screen.getByRole("button", { name: "About VPIP" });
        expect(button).toHaveAttribute("aria-expanded", "false");
        expect(button).toHaveTextContent("ⓘ");

        fireEvent.click(button);
        const tip = screen.getByRole("tooltip");
        expect(tip.querySelector("strong")).toHaveTextContent("Voluntarily put money in pot.");
        expect(tip).toHaveTextContent("not just posting blinds");
        expect(button).toHaveAttribute("aria-expanded", "true");
        expect(button).toHaveAttribute("aria-controls", tip.id);

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

        fireEvent.click(button);
        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("opens on hover for a mouse and leaves a click alone", () => {
        media(true);
        render(<PlayingStyleTip figure={vpip} />);
        const button = screen.getByRole("button", { name: "About VPIP" });
        fireEvent.mouseEnter(button);
        expect(screen.getByRole("tooltip")).toBeInTheDocument();
        fireEvent.click(button);
        expect(screen.getByRole("tooltip")).toBeInTheDocument();
        fireEvent.mouseLeave(button);
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
});
