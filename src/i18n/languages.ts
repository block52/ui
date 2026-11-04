import { hasValue } from "../utils/guards";

/** The languages a player can choose, each named in its own script. */
export const LANGUAGES = [
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "pt", name: "Português" },
    { code: "de", name: "Deutsch" },
    { code: "fr", name: "Français" },
    { code: "it", name: "Italiano" },
    { code: "ru", name: "Русский" },
    { code: "tr", name: "Türkçe" },
    { code: "ar", name: "العربية" },
    { code: "hi", name: "हिन्दी" },
    { code: "zh", name: "简体中文" },
    { code: "ja", name: "日本語" },
    { code: "ko", name: "한국어" },
    { code: "vi", name: "Tiếng Việt" },
    { code: "th", name: "ไทย" },
    { code: "id", name: "Bahasa Indonesia" }
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export const isLanguageCode = (code: string | null | undefined): code is LanguageCode => hasValue(code) && LANGUAGES.some(l => l.code === code);

/** The first browser language we support ("de-AT" counts as "de"), else English. */
export function matchBrowserLanguage(browserLanguages: readonly string[]): LanguageCode {
    for (const tag of browserLanguages) {
        const base = tag.toLowerCase().split("-")[0];
        if (isLanguageCode(base)) return base;
    }
    return DEFAULT_LANGUAGE;
}
