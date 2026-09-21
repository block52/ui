/**
 * Tests for ActionSoundPlayer (ui#624) — preloaded, low-latency sound playback.
 * Everything is injected, so no browser audio stack is involved.
 */
import { ActionSoundPlayer, type AudioContextLike, type AudioElementLike, type ActionSoundPlayerDeps } from "./actionSoundPlayer";

const CHECK = "https://cdn.test/sounds/check.mp3";
const FOLD = "https://cdn.test/sounds/fold.mp3";

function fakeContext(state: "running" | "suspended" = "running") {
    const started: Array<{ buffer: unknown; volume: number }> = [];
    const context = {
        state,
        destination: { node: "destination" },
        resume: jest.fn(async () => {
            context.state = "running";
        }),
        decodeAudioData: jest.fn(async (bytes: ArrayBuffer) => ({ decodedFrom: bytes.byteLength })),
        createBufferSource: () => {
            const source = { buffer: null as unknown, gainNode: null as { gain: { value: number } } | null, connect: (node: unknown) => (source.gainNode = node as never), start: () => started.push({ buffer: source.buffer, volume: source.gainNode?.gain.value ?? -1 }) };
            return source;
        },
        createGain: () => ({ gain: { value: 1 }, connect: jest.fn() })
    };
    return { context: context as unknown as AudioContextLike & { state: string; resume: jest.Mock; decodeAudioData: jest.Mock }, started };
}

function fakeElement(): AudioElementLike & { play: jest.Mock; load: jest.Mock } {
    return { preload: "", volume: 1, currentTime: 5, paused: true, ended: false, play: jest.fn(async () => {}), load: jest.fn() };
}

function setup(overrides: Partial<ActionSoundPlayerDeps> = {}, state: "running" | "suspended" = "running") {
    const { context, started } = fakeContext(state);
    const elements: Array<ReturnType<typeof fakeElement>> = [];
    let gesture: (() => void) | null = null;
    const deps: ActionSoundPlayerDeps = {
        createContext: jest.fn(() => context),
        fetchBytes: jest.fn(async () => new ArrayBuffer(8)),
        createElement: jest.fn(() => {
            const element = fakeElement();
            elements.push(element);
            return element;
        }),
        onFirstGesture: jest.fn(listener => {
            gesture = listener;
            return () => {
                gesture = null;
            };
        }),
        ...overrides
    };
    return { player: new ActionSoundPlayer(deps), deps, context, started, elements, fireGesture: () => gesture?.() };
}

const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

describe("ActionSoundPlayer", () => {
    describe("preload", () => {
        it("fetches and decodes each sound once, however often it is asked", async () => {
            const { player, deps, context } = setup();
            player.preload([CHECK, FOLD]);
            player.preload([CHECK, FOLD]);
            await flush();
            player.preload([CHECK]);
            await flush();

            expect(deps.fetchBytes).toHaveBeenCalledTimes(2);
            expect(context.decodeAudioData).toHaveBeenCalledTimes(2);
            expect(deps.createContext).toHaveBeenCalledTimes(1);
            expect(player.isDecoded(CHECK)).toBe(true);
        });

        it("warms a preload=auto element per sound, so the fallback never waits on the network either", () => {
            const { player, elements } = setup();
            player.preload([CHECK, FOLD]);

            expect(elements).toHaveLength(2);
            expect(elements.every(element => element.preload === "auto")).toBe(true);
            expect(elements.every(element => element.load.mock.calls.length === 1)).toBe(true);
        });
    });

    describe("play", () => {
        it("plays a decoded sound from its buffer at the requested volume — no element, no fetch", async () => {
            const { player, deps, started, elements } = setup();
            player.preload([CHECK]);
            await flush();
            (deps.fetchBytes as jest.Mock).mockClear();

            player.play(CHECK, 0.5);

            expect(started).toEqual([{ buffer: { decodedFrom: 8 }, volume: 0.5 }]);
            expect(elements[0].play).not.toHaveBeenCalled();
            expect(deps.fetchBytes).not.toHaveBeenCalled();
        });

        it("falls back to the warmed element while the sound is still decoding", () => {
            const { player, started, elements } = setup();
            player.preload([CHECK]);
            player.play(CHECK, 0.3);

            expect(started).toEqual([]);
            expect(elements[0].play).toHaveBeenCalledTimes(1);
            expect(elements[0].volume).toBe(0.3);
            expect(elements[0].currentTime).toBe(0);
        });

        it("falls back to the element when Web Audio is unavailable", async () => {
            const { player, deps, elements } = setup({ createContext: () => null });
            player.preload([CHECK]);
            await flush();
            player.play(CHECK, 0.5);

            expect(deps.fetchBytes).not.toHaveBeenCalled();
            expect(elements[0].play).toHaveBeenCalledTimes(1);
        });

        it("falls back to the element when a sound fails to decode", async () => {
            const { player, elements } = setup({ fetchBytes: jest.fn(async () => Promise.reject(new Error("404"))) });
            player.preload([CHECK]);
            await flush();
            player.play(CHECK, 0.5);

            expect(player.isDecoded(CHECK)).toBe(false);
            expect(elements[0].play).toHaveBeenCalledTimes(1);
        });

        it("overlaps rapid repeats on the element path instead of cutting the first off, up to a small pool", () => {
            const { player, elements } = setup({ createContext: () => null });
            player.preload([CHECK]);
            for (let i = 0; i < 5; i++) {
                player.play(CHECK, 0.5);
                elements.forEach(element => (element.paused = false)); // still sounding
            }

            expect(elements).toHaveLength(3);
            expect(elements.reduce((plays, element) => plays + element.play.mock.calls.length, 0)).toBe(5);
        });

        it("never throws, whatever the audio stack does — it runs inside a React effect", () => {
            const { player } = setup({
                createContext: () => {
                    throw new Error("no audio device");
                },
                createElement: () => {
                    throw new Error("no Audio constructor");
                }
            });
            expect(() => player.preload([CHECK])).not.toThrow();
            expect(() => player.play(CHECK, 0.5)).not.toThrow();
        });
    });

    describe("autoplay policy", () => {
        it("uses the element until the first gesture resumes a suspended context, then the buffer", async () => {
            const { player, context, started, elements, fireGesture } = setup({}, "suspended");
            player.preload([CHECK]);
            await flush();

            player.play(CHECK, 0.5);
            expect(started).toHaveLength(0);
            expect(elements[0].play).toHaveBeenCalledTimes(1);

            fireGesture();
            await flush();
            expect(context.resume).toHaveBeenCalledTimes(1);

            player.play(CHECK, 0.5);
            expect(started).toHaveLength(1);
            expect(elements[0].play).toHaveBeenCalledTimes(1);
        });

        it("does not listen for a gesture when the context is already running", () => {
            const { player, deps } = setup({}, "running");
            player.preload([CHECK]);
            expect(deps.onFirstGesture).not.toHaveBeenCalled();
        });
    });
});
