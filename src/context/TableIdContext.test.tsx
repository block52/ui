import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TableIdProvider, useTableId } from "./TableIdContext";

const Probe: React.FC<{ testId: string }> = ({ testId }) => <span data-testid={testId}>{useTableId() ?? "none"}</span>;

const renderAtRoute = (ui: React.ReactElement) =>
    render(
        <MemoryRouter initialEntries={["/table/0xvisible"]}>
            <Routes>
                <Route path="/table/:id" element={ui} />
            </Routes>
        </MemoryRouter>
    );

describe("useTableId (ui#834)", () => {
    it("falls back to the route id with no provider (single-table page)", () => {
        renderAtRoute(<Probe testId="id" />);
        expect(screen.getByTestId("id")).toHaveTextContent("0xvisible");
    });

    it("gives each mounted table its own id, not the route's active one", () => {
        renderAtRoute(
            <>
                <TableIdProvider value="0xvisible">
                    <Probe testId="a" />
                </TableIdProvider>
                <TableIdProvider value="0xhidden">
                    <Probe testId="b" />
                </TableIdProvider>
            </>
        );
        expect(screen.getByTestId("a")).toHaveTextContent("0xvisible");
        // The hidden table must act on ITSELF even though the URL names the other.
        expect(screen.getByTestId("b")).toHaveTextContent("0xhidden");
    });
});
