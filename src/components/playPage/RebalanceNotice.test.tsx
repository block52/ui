import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("../../utils/colorConfig", () => ({
    colors: { brand: { primary: "#3b82f6" } },
    getHexagonStroke: () => "#ffffff"
}));

// eslint-disable-next-line import/first
import { RebalanceNotice } from "./RebalanceNotice";

describe("RebalanceNotice", () => {
    it("renders nothing when there is no notice", () => {
        const { container } = render(<RebalanceNotice notice={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows the waiting message with a spinner", () => {
        render(<RebalanceNotice notice={{ kind: "waiting" }} />);
        expect(screen.getByTestId("rebalance-notice")).toHaveTextContent(
            "Tables are being rebalanced. Your game will resume shortly."
        );
        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(screen.getByText("Rebalancing")).toBeInTheDocument();
        expect(document.querySelector("svg.animate-spin")).toBeTruthy();
    });

    it("shows the destination table when the player is being moved", () => {
        render(<RebalanceNotice notice={{ kind: "moving", tableNumber: 3, gameId: "0xabc-t3" }} />);
        expect(screen.getByTestId("rebalance-notice")).toHaveTextContent("You are being moved to Table 3");
    });

    it("does not draw a blocking backdrop, so controls behind it stay clickable", async () => {
        const onLeave = jest.fn();
        render(
            <>
                <button type="button" data-testid="leave-table" onClick={onLeave}>
                    Leave Table
                </button>
                <RebalanceNotice notice={{ kind: "waiting" }} />
            </>
        );

        expect(screen.getByTestId("modal-overlay-pass-through")).toHaveClass("pointer-events-none");
        expect(document.querySelector(".bg-opacity-50")).toBeNull();
        await userEvent.click(screen.getByTestId("leave-table"));
        expect(onLeave).toHaveBeenCalledTimes(1);
    });
});
