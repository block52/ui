import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

const renderModal = (props: Partial<React.ComponentProps<typeof Modal>> = {}) => {
    const onClose = jest.fn();
    const utils = render(
        <Modal isOpen onClose={onClose} title="Confirm" {...props}>
            <input aria-label="Amount" />
            <button type="button">Save</button>
        </Modal>
    );
    return { onClose, ...utils };
};

const backdrop = (): HTMLElement => {
    const el = screen.getByRole("dialog").previousElementSibling;
    if (!(el instanceof HTMLElement)) throw new Error("backdrop not found");
    return el;
};

describe("Modal closing", () => {
    it("closes on Escape, backdrop click and the X", () => {
        const { onClose } = renderModal();
        fireEvent.keyDown(window, { key: "Escape" });
        fireEvent.click(backdrop());
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(3);
    });

    it("blocks Escape, backdrop and X while processing", () => {
        const { onClose } = renderModal({ isProcessing: true });
        fireEvent.keyDown(window, { key: "Escape" });
        fireEvent.click(backdrop());
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("honours closeOnEscape and closeOnBackdropClick", () => {
        const { onClose } = renderModal({ closeOnEscape: false, closeOnBackdropClick: false });
        fireEvent.keyDown(window, { key: "Escape" });
        fireEvent.click(backdrop());
        expect(onClose).not.toHaveBeenCalled();
    });

    it("hides the X with hideCloseButton", () => {
        renderModal({ hideCloseButton: true });
        expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    });

    it("renders nothing when closed", () => {
        renderModal({ isOpen: false });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});

describe("Modal naming", () => {
    it("uses the title as the accessible name", () => {
        renderModal();
        expect(screen.getByRole("dialog", { name: "Confirm" })).toBeInTheDocument();
    });

    it("uses ariaLabel when there is no title", () => {
        renderModal({ title: undefined, ariaLabel: "Sit and Go result" });
        expect(screen.getByRole("dialog", { name: "Sit and Go result" })).toBeInTheDocument();
    });
});

describe("Modal focus management", () => {
    it("moves focus to the first control that is not the close X", () => {
        renderModal();
        expect(screen.getByLabelText("Amount")).toHaveFocus();
    });

    it("focuses the dialog itself when it has nothing focusable", () => {
        render(
            <Modal isOpen onClose={jest.fn()} hideCloseButton>
                <p>Nothing to press</p>
            </Modal>
        );
        expect(screen.getByRole("dialog")).toHaveFocus();
    });

    it("prefers a data-autofocus element", () => {
        render(
            <Modal isOpen onClose={jest.fn()} title="Delete">
                <button type="button">First</button>
                <button type="button" data-autofocus="">
                    Cancel
                </button>
            </Modal>
        );
        expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    it("wraps Tab from the last control to the first and Shift+Tab back", async () => {
        const user = userEvent.setup();
        renderModal();
        const close = screen.getByRole("button", { name: "Close" });
        const save = screen.getByRole("button", { name: "Save" });
        save.focus();
        await user.tab();
        expect(close).toHaveFocus();
        await user.tab({ shift: true });
        expect(save).toHaveFocus();
    });

    it("returns focus to the trigger when it closes", () => {
        const Harness = () => {
            const [open, setOpen] = React.useState(false);
            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>
                        Open
                    </button>
                    <Modal isOpen={open} onClose={() => setOpen(false)} title="Dialog">
                        <button type="button">Inside</button>
                    </Modal>
                </>
            );
        };
        render(<Harness />);
        const trigger = screen.getByRole("button", { name: "Open" });
        trigger.focus();
        fireEvent.click(trigger);
        expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});
