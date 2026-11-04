import { useSyncExternalStore } from "react";
import { getLanguage, setLanguage, subscribeToLanguage, t } from "./index";

/** Re-renders the component when the language changes; use its `t` for text. */
export function useLanguage() {
    const language = useSyncExternalStore(subscribeToLanguage, getLanguage);
    return { language, setLanguage, t };
}
