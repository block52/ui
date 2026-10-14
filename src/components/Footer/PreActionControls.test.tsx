/**
 * Tests for PreActionControls (ui#388) — renders the pre-action bar from a `buttons`
 * list (from preActionButtons). Empty list renders nothing; "call-exact" shows the
 * owed amount; "all-in" shows "All In".
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { PreActionControls } from "./PreActionControls";
import { PreAction } from "../../utils/preActions";

describe("PreActionControls", () => {
    const setup = (buttons: PreAction[], props: Partial<React.ComponentProps<typeof PreActionControls>> = {}) => {
        const onArm = jest.fn();
        render(<PreActionControls buttons={buttons} armed={null} onArm={onArm} callAmountLabel="$3" {...props} />);
        return { onArm };
    };

    it("renders nothing when the button list is empty (committed, nothing owed)", () => {
        const { onArm } = setup([]);
        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
        expect(onArm).not.toHaveBeenCalled();
    });

    it("can-check set: Check/Fold · Check · Call Any", () => {
        const { onArm } = setup(["check-fold", "check", "call-any"]);
        expect(screen.getByText("Check/Fold")).toBeInTheDocument();
        expect(screen.getByText("Check")).toBeInTheDocument();
        expect(screen.getByText("Call Any")).toBeInTheDocument();
        expect(screen.queryByText("Fold")).not.toBeInTheDocument();
        fireEvent.click(screen.getByText("Check/Fold"));
        expect(onArm).toHaveBeenCalledWith("check-fold");
    });

    it("owe-a-bet set: Fold · Call {amount} · Call Any (no Check)", () => {
        const { onArm } = setup(["fold", "call-exact", "call-any"], { callAmountLabel: "$3" });
        expect(screen.getByText("Fold")).toBeInTheDocument();
        expect(screen.getByText("Call $3")).toBeInTheDocument();
        expect(screen.getByText("Call Any")).toBeInTheDocument();
        expect(screen.queryByText("Check")).not.toBeInTheDocument();
        expect(screen.queryByText("Check/Fold")).not.toBeInTheDocument();
        fireEvent.click(screen.getByText("Call $3"));
        expect(onArm).toHaveBeenCalledWith("call-exact");
    });

    it("all-in set: Fold · All In only", () => {
        const { onArm } = setup(["fold", "all-in"]);
        expect(screen.getByText("Fold")).toBeInTheDocument();
        expect(screen.getByText("All In")).toBeInTheDocument();
        expect(screen.queryByText(/Call/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByText("All In"));
        expect(onArm).toHaveBeenCalledWith("all-in");
    });

    it("clicking the armed button disarms it (null)", () => {
        const { onArm } = setup(["check-fold", "check", "call-any"], { armed: "check-fold" });
        fireEvent.click(screen.getByText("Check/Fold"));
        expect(onArm).toHaveBeenCalledWith(null);
    });

    it("reflects the armed state via aria-checked", () => {
        setup(["check-fold", "check", "call-any"], { armed: "call-any" });
        expect(screen.getByLabelText("Pre-select Call Any for your turn")).toHaveAttribute("aria-checked", "true");
        expect(screen.getByLabelText("Pre-select Check/Fold for your turn")).toHaveAttribute("aria-checked", "false");
    });
});
