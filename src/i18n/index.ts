import { en, type TranslationKey, type Translations } from "./en";
import { DEFAULT_LANGUAGE, isLanguageCode, matchBrowserLanguage, type LanguageCode } from "./languages";
import { isNullish } from "../utils/guards";

export { LANGUAGES, type LanguageCode } from "./languages";
export type { TranslationKey } from "./en";

const STORAGE_KEY = "b52.language";

// One chunk per language, so a player only downloads the one they use.
const LOADERS: Record<Exclude<LanguageCode, "en">, () => Promise<{ default: Translations }>> = {
    es: () => import("./locales/es"),
    pt: () => import("./locales/pt"),
    de: () => import("./locales/de"),
    fr: () => import("./locales/fr"),
    it: () => import("./locales/it"),
    ru: () => import("./locales/ru"),
    tr: () => import("./locales/tr"),
    ar: () => import("./locales/ar"),
    hi: () => import("./locales/hi"),
    zh: () => import("./locales/zh"),
    ja: () => import("./locales/ja"),
    ko: () => import("./locales/ko"),
    vi: () => import("./locales/vi"),
    th: () => import("./locales/th"),
    id: () => import("./locales/id")
};

let language: LanguageCode = DEFAULT_LANGUAGE;
let strings: Translations = en;
let latestRequest = 0;
const listeners = new Set<() => void>();

/** The language showing now. It changes once the new language has loaded. */
export const getLanguage = (): LanguageCode => language;

export const subscribeToLanguage = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** The player's saved choice, else their browser's language when we support it. */
export function readSavedLanguage(): LanguageCode {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (isLanguageCode(saved)) return saved;
    } catch {
        // Storage blocked: fall through to the browser's language.
    }
    return matchBrowserLanguage(typeof navigator === "undefined" ? [] : navigator.languages ?? []);
}

async function show(next: LanguageCode): Promise<void> {
    const request = ++latestRequest;
    const nextStrings = next === "en" ? en : (await LOADERS[next]()).default;
    if (request !== latestRequest) return; // the player has since picked another
    language = next;
    strings = nextStrings;
    document.documentElement.lang = next;
    listeners.forEach(listener => listener());
}

/** Switches language now and remembers the choice. */
export async function setLanguage(next: LanguageCode): Promise<void> {
    try {
        localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {
        console.error("Could not save the language choice:", err);
    }
    await show(next);
}

/** Shows the saved language at startup. English stays up if its file can't load. */
export function initLanguage(): void {
    const saved = readSavedLanguage();
    if (saved === DEFAULT_LANGUAGE) return;
    show(saved).catch(err => console.error("Could not load the language:", err));
}

/** The text for a key in the current language, with {name} placeholders filled in. */
export function t(key: TranslationKey, values?: Record<string, string | number>): string {
    const text = strings[key];
    if (isNullish(values)) return text;
    return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => (name in values ? String(values[name]) : placeholder));
}
