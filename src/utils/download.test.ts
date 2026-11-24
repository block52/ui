import { downloadJson } from "./download";

describe("downloadJson", () => {
    it("clicks a temporary link to a JSON blob, then cleans up", () => {
        const createObjectURL = jest.fn(() => "blob:record");
        const revokeObjectURL = jest.fn();
        Object.assign(URL, { createObjectURL, revokeObjectURL });
        const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            expect(this.download).toBe("record.json");
            expect(this.href).toBe("blob:record");
        });

        downloadJson("record.json", { a: 1 });

        expect(click).toHaveBeenCalledTimes(1);
        const blob = (createObjectURL.mock.calls[0] as unknown[])[0] as Blob;
        expect(blob.type).toBe("application/json");
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:record");
        expect(document.querySelector("a[download]")).toBeNull();
        click.mockRestore();
    });
});
