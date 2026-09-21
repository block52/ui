/**
 * ActionSoundPlayer — preloaded, low-latency playback for short UI sounds (ui#624).
 *
 * Plain TypeScript, no React, dependencies injected — unit-testable without a
 * browser audio stack, like the bus and the submit controller.
 *
 * Why it exists: every play used to be `new Audio(cdnUrl).play()`. The first
 * play of each sound in a session paid a CDN fetch + decode (hundreds of ms
 * cold), and every later play still paid element creation + decode. At a poker
 * table that reads as "the sounds are late".
 *
 * Two paths, fastest first:
 *
 *   1. Web Audio. Each sound is fetched and decoded ONCE into an AudioBuffer;
 *      a play is a BufferSource start — a few ms, and overlapping plays are
 *      free. Browsers start an AudioContext `suspended` until a user gesture, so
 *      the first pointer/key event resumes it.
 *   2. A pooled <audio preload="auto"> element per sound. Used when Web Audio is
 *      unavailable, the context is still suspended, or a buffer is not decoded
 *      yet. The element is created at preload time, so even this path never
 *      waits on the network at play time.
 *
 * Nothing here throws: a sound that cannot play is dropped silently, as before.
 */

/** The slice of AudioContext this module uses. */
export interface AudioContextLike {
    readonly state: string;
    readonly destination: unknown;
    resume(): Promise<void>;
    decodeAudioData(bytes: ArrayBuffer): Promise<unknown>;
    createBufferSource(): { buffer: unknown; connect(node: unknown): unknown; start(when?: number): void };
    createGain(): { gain: { value: number }; connect(node: unknown): unknown };
}

/** The slice of HTMLAudioElement this module uses. */
export interface AudioElementLike {
    preload: string;
    volume: number;
    currentTime: number;
    paused: boolean;
    ended: boolean;
    play(): Promise<void> | void;
    load?(): void;
}

export interface ActionSoundPlayerDeps {
    /** Returns null where Web Audio is unavailable. */
    createContext: () => AudioContextLike | null;
    fetchBytes: (url: string) => Promise<ArrayBuffer>;
    createElement: (url: string) => AudioElementLike;
    /** Registers a one-shot listener for the first user gesture; returns an unsubscribe. */
    onFirstGesture: (listener: () => void) => () => void;
}

/** Elements kept per sound so rapid repeats overlap instead of cutting each other off. */
const MAX_POOL_PER_SOUND = 3;

export class ActionSoundPlayer {
    private context: AudioContextLike | null | undefined;
    private readonly buffers = new Map<string, unknown>();
    private readonly decoding = new Set<string>();
    private readonly pools = new Map<string, AudioElementLike[]>();
    private stopListening: (() => void) | null = null;

    constructor(private readonly deps: ActionSoundPlayerDeps) {}

    /** Warm every sound. Idempotent — safe to call from every component that plays one. */
    public preload(urls: readonly string[]): void {
        const context = this.ensureContext();
        for (const url of urls) {
            try {
                this.ensurePool(url);
            } catch {
                // No usable <audio> here. Called from a React effect, so it must
                // not throw; the buffer path below may still work.
            }
            if (context) {
                void this.decode(context, url);
            }
        }
    }

    public play(url: string, volume: number): void {
        try {
            const context = this.ensureContext();
            const buffer = this.buffers.get(url);
            if (context && buffer && context.state === "running") {
                const source = context.createBufferSource();
                const gain = context.createGain();
                source.buffer = buffer;
                gain.gain.value = volume;
                source.connect(gain);
                gain.connect(context.destination);
                source.start();
                return;
            }
            this.playElement(url, volume);
        } catch {
            // A sound that cannot play is dropped, never surfaced.
        }
    }

    /** True once `url` plays from a decoded buffer (exposed for the sound log / tests). */
    public isDecoded(url: string): boolean {
        return this.buffers.has(url);
    }

    private ensureContext(): AudioContextLike | null {
        if (this.context !== undefined) {
            return this.context;
        }
        try {
            this.context = this.deps.createContext();
        } catch {
            this.context = null;
        }
        const context = this.context;
        if (context && context.state !== "running") {
            // Autoplay policy: resume inside the first gesture. Until then plays
            // take the element path, which the same policy governs anyway.
            this.stopListening = this.deps.onFirstGesture(() => {
                this.stopListening?.();
                this.stopListening = null;
                context.resume().catch(() => {});
            });
        }
        return context;
    }

    private async decode(context: AudioContextLike, url: string): Promise<void> {
        if (this.buffers.has(url) || this.decoding.has(url)) {
            return;
        }
        this.decoding.add(url);
        try {
            const bytes = await this.deps.fetchBytes(url);
            this.buffers.set(url, await context.decodeAudioData(bytes));
        } catch {
            // Leave it undecoded: play() falls back to the element path.
        } finally {
            this.decoding.delete(url);
        }
    }

    private ensurePool(url: string): AudioElementLike[] {
        let pool = this.pools.get(url);
        if (!pool) {
            pool = [this.newElement(url)];
            this.pools.set(url, pool);
        }
        return pool;
    }

    private newElement(url: string): AudioElementLike {
        const element = this.deps.createElement(url);
        element.preload = "auto";
        element.load?.();
        return element;
    }

    private playElement(url: string, volume: number): void {
        const pool = this.ensurePool(url);
        let element = pool.find(candidate => candidate.paused || candidate.ended);
        if (!element) {
            if (pool.length < MAX_POOL_PER_SOUND) {
                element = this.newElement(url);
                pool.push(element);
            } else {
                element = pool[0];
            }
        }
        element.currentTime = 0;
        element.volume = volume;
        const playing = element.play();
        if (playing && typeof playing.catch === "function") {
            playing.catch(() => {
                // Autoplay policy or a decode error — ignore, as before.
            });
        }
    }
}

type AudioContextCtor = new () => AudioContextLike;

/** Browser wiring. Every dependency degrades to "unavailable" rather than throwing. */
export function createBrowserActionSoundPlayer(): ActionSoundPlayer {
    return new ActionSoundPlayer({
        createContext: () => {
            if (typeof window === "undefined") {
                return null;
            }
            const scope = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
            const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
            return Ctor ? new Ctor() : null;
        },
        fetchBytes: async url => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`sound fetch failed: ${response.status}`);
            }
            return response.arrayBuffer();
        },
        createElement: url => new Audio(url),
        onFirstGesture: listener => {
            if (typeof window === "undefined") {
                return () => {};
            }
            const events = ["pointerdown", "keydown", "touchstart"] as const;
            const remove = () => events.forEach(name => window.removeEventListener(name, listener));
            events.forEach(name => window.addEventListener(name, listener, { once: true, passive: true }));
            return remove;
        }
    });
}

let shared: ActionSoundPlayer | null = null;

/** One player for the app: one AudioContext, one decode per sound. */
export function getActionSoundPlayer(): ActionSoundPlayer {
    shared ??= createBrowserActionSoundPlayer();
    return shared;
}
