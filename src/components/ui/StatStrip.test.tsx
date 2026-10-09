import React from "react";
import { render, screen } from "@testing-library/react";
import { StatStrip } from "./StatStrip";

describe("StatStrip", () => {
    it("renders duplicate labels without React key warnings", () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        render(
            <StatStrip
                items={[
                    { label: "Nodes", value: 1 },
                    { label: "Nodes", value: 2 }
                ]}
            />
        );
        expect(screen.getAllByText("Nodes")).toHaveLength(2);
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});
