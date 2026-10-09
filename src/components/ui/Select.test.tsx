import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Select, SelectOption } from "./Select";

const OPTIONS: ReadonlyArray<SelectOption> = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "signed", label: "Signed", disabled: true },
    { value: "done", label: "Completed" }
];

const Harness = ({ onChange }: { onChange?: (value: string) => void }) => {
    const [value, setValue] = useState("all");
    return (
        <Select
            aria-label="Filter"
            value={value}
            onChange={next => {
                setValue(next);
                onChange?.(next);
            }}
            options={OPTIONS}
        />
    );
};

describe("Select", () => {
    it("shows the selected label and opens a listbox in the document body", () => {
        render(<Harness />);
        expect(screen.getByRole("combobox", { name: "Filter" })).toHaveTextContent("All");
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("combobox"));
        const list = screen.getByRole("listbox");
        expect(list.parentElement).toBe(document.body);
        expect(screen.getAllByRole("option")).toHaveLength(4);
        expect(screen.getByRole("option", { name: "All" })).toHaveAttribute("aria-selected", "true");
    });

    it("chooses an option with the mouse and closes", () => {
        const onChange = jest.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.click(screen.getByRole("combobox"));
        fireEvent.click(screen.getByRole("option", { name: "Pending" }));
        expect(onChange).toHaveBeenCalledWith("pending");
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(screen.getByRole("combobox")).toHaveTextContent("Pending");
    });

    it("does not choose a disabled option", () => {
        const onChange = jest.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.click(screen.getByRole("combobox"));
        fireEvent.click(screen.getByRole("option", { name: "Signed" }));
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("moves with the arrow keys, skips disabled options and selects with Enter", () => {
        const onChange = jest.fn();
        render(<Harness onChange={onChange} />);
        const trigger = screen.getByRole("combobox");
        fireEvent.keyDown(trigger, { key: "ArrowDown" });
        expect(screen.getByRole("listbox")).toBeInTheDocument();
        fireEvent.keyDown(trigger, { key: "ArrowDown" });
        fireEvent.keyDown(trigger, { key: "ArrowDown" });
        fireEvent.keyDown(trigger, { key: "Enter" });
        expect(onChange).toHaveBeenCalledWith("done");
    });

    it("closes on Escape without letting the key reach a surrounding modal", () => {
        const outer = jest.fn();
        render(
            <div onKeyDown={outer}>
                <Harness />
            </div>
        );
        const trigger = screen.getByRole("combobox");
        fireEvent.click(trigger);
        fireEvent.keyDown(trigger, { key: "Escape" });
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(outer).not.toHaveBeenCalled();

        fireEvent.keyDown(trigger, { key: "Escape" });
        expect(outer).toHaveBeenCalledTimes(1);
    });

    it("closes when clicking outside", () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole("combobox"));
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("does not open when disabled", () => {
        render(<Select aria-label="Filter" value="all" onChange={() => undefined} options={OPTIONS} disabled />);
        fireEvent.click(screen.getByRole("combobox"));
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("shows the placeholder when the value matches no option", () => {
        render(<Select aria-label="Filter" value="nope" onChange={() => undefined} options={OPTIONS} placeholder="Pick one" />);
        expect(screen.getByRole("combobox")).toHaveTextContent("Pick one");
    });

    it("selects by typing the first letters of a label", () => {
        const onChange = jest.fn();
        render(<Harness onChange={onChange} />);
        fireEvent.keyDown(screen.getByRole("combobox"), { key: "c" });
        expect(onChange).toHaveBeenCalledWith("done");
    });
});
