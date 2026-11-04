import { installBlindClickGuard, isRenderStalled, RENDER_STALL_THRESHOLD_MS } from "./blindClickGuard";

describe("isRenderStalled", () => {
    const now = 10_000;

    it("is false while frames are recent", () => {
        expect(isRenderStalled(now - RENDER_STALL_THRESHOLD_MS, now, now)).toBe(false);
    });

    it("is true when frames stopped but timers are still running (GPU loss)", () => {
        expect(isRenderStalled(now - RENDER_STALL_THRESHOLD_MS - 1, now - 10, now)).toBe(true);
    });

    it("is false when frames and timers stalled together (main thread was busy, last frame still on screen)", () => {
        expect(isRenderStalled(now - 2000, now - 2000, now)).toBe(false);
    });

    it("honours a custom threshold", () => {
        expect(isRenderStalled(now - 300, now, now, 200)).toBe(true);
        expect(isRenderStalled(now - 100, now, now, 200)).toBe(false);
    });
});

describe("installBlindClickGuard", () => {
    let clock: number;
    let pendingFrame: FrameRequestCallback | undefined;
    let visibility: DocumentVisibilityState;
    let teardown: () => void;
    let onBlocked: jest.Mock;
    let button: HTMLButtonElement;
    let buttonClicked: jest.Mock;

    /** Paint one frame (the browser is drawing). */
    const paint = () => {
        const cb = pendingFrame;
        pendingFrame = undefined;
        cb?.(clock);
    };
    /** Time passes with timers firing (main thread alive). */
    const advance = (ms: number) => {
        clock += ms;
        jest.advanceTimersByTime(ms);
    };
    /** Time passes inside one long task: no timers, no frames. */
    const block = (ms: number) => {
        clock += ms;
    };
    const press = () => {
        button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    };

    beforeEach(() => {
        jest.useFakeTimers();
        clock = 10_000;
        visibility = "visible";
        jest.spyOn(window.performance, "now").mockImplementation(() => clock);
        jest.spyOn(window, "requestAnimationFrame").mockImplementation(cb => {
            pendingFrame = cb;
            return 1;
        });
        jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
            pendingFrame = undefined;
        });
        jest.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);

        button = document.createElement("button");
        buttonClicked = jest.fn();
        button.addEventListener("click", buttonClicked);
        document.body.appendChild(button);

        onBlocked = jest.fn();
        teardown = installBlindClickGuard(window, onBlocked);
    });

    afterEach(() => {
        teardown();
        button.remove();
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it("lets clicks through while frames are being painted", () => {
        advance(16);
        paint();
        press();
        expect(buttonClicked).toHaveBeenCalledTimes(1);
        expect(onBlocked).not.toHaveBeenCalled();
    });

    it("lets a click through after a main-thread long task (screen still showed the last frame)", () => {
        paint();
        block(2000);
        press();
        expect(buttonClicked).toHaveBeenCalledTimes(1);
        expect(onBlocked).not.toHaveBeenCalled();
    });

    it("reports a blocked pointerdown + mousedown press once", () => {
        paint();
        advance(RENDER_STALL_THRESHOLD_MS + 500);
        button.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
        press();
        expect(buttonClicked).not.toHaveBeenCalled();
        expect(onBlocked).toHaveBeenCalledTimes(1);
    });

    it("swallows a click while no frame has been painted for over the threshold (black screen)", () => {
        paint();
        advance(RENDER_STALL_THRESHOLD_MS + 500);
        press();
        expect(buttonClicked).not.toHaveBeenCalled();
        expect(onBlocked).toHaveBeenCalledTimes(1);
    });

    it("also swallows the click that follows a blocked press, even if painting resumed in between", () => {
        paint();
        advance(RENDER_STALL_THRESHOLD_MS + 500);
        button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        advance(16);
        paint(); // screen comes back between press and release
        button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(buttonClicked).not.toHaveBeenCalled();
        expect(onBlocked).toHaveBeenCalledTimes(1);
    });

    it("accepts clicks again once painting resumes", () => {
        paint();
        advance(RENDER_STALL_THRESHOLD_MS + 500);
        press();
        advance(16);
        paint();
        press();
        expect(buttonClicked).toHaveBeenCalledTimes(1);
    });

    it("blocks a keyboard-activated click (no press) during a stall", () => {
        paint();
        advance(RENDER_STALL_THRESHOLD_MS + 500);
        button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(buttonClicked).not.toHaveBeenCalled();
        expect(onBlocked).toHaveBeenCalledTimes(1);
    });

    it("does not treat returning to a hidden tab as a stall", () => {
        paint();
        visibility = "hidden";
        document.dispatchEvent(new Event("visibilitychange"));
        advance(60_000); // no frames while hidden, by design
        visibility = "visible";
        document.dispatchEvent(new Event("visibilitychange"));
        press();
        expect(buttonClicked).toHaveBeenCalledTimes(1);
        expect(onBlocked).not.toHaveBeenCalled();
    });

    it("stops filtering after teardown", () => {
        paint();
        teardown();
        advance(RENDER_STALL_THRESHOLD_MS + 500);
        press();
        expect(buttonClicked).toHaveBeenCalledTimes(1);
        teardown = () => undefined;
    });
});
