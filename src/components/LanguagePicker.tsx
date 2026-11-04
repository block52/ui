import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FaCheck, FaGlobe, FaTimes } from "react-icons/fa";
import { LANGUAGES, type LanguageCode } from "../i18n";
import { useLanguage } from "../i18n/useLanguage";

interface LanguagePickerProps {
    /** "icon" for headers; "row" for a settings list. */
    variant: "icon" | "row";
}

/** A globe button that opens the list of languages, with a tick on the current one. */
export const LanguagePicker: React.FC<LanguagePickerProps> = ({ variant }) => {
    const { language, setLanguage, t } = useLanguage();
    const [open, setOpen] = useState(false);
    const current = LANGUAGES.find(l => l.code === language);

    const choose = (code: LanguageCode) => {
        setLanguage(code).catch(err => console.error("Could not switch language:", err));
        setOpen(false);
    };

    return (
        <>
            {variant === "icon" ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex items-center gap-1.5 p-2 rounded-lg text-sm text-gray-300 hover:text-white hover:opacity-80 transition-opacity"
                    title={t("language.choose")}
                    aria-label={t("language.choose")}
                    data-testid="language-button"
                >
                    <FaGlobe size={14} />
                    <span className="uppercase text-xs font-semibold">{language}</span>
                </button>
            ) : (
                <div className="flex items-center justify-between py-3 border-b border-white/10">
                    <p className="text-white text-xs font-semibold leading-tight">{t("language.title")}</p>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-700/70 text-[11px] font-semibold text-gray-200 hover:text-white"
                        data-testid="language-button"
                    >
                        <FaGlobe size={11} />
                        {current?.name}
                    </button>
                </div>
            )}

            {open &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 p-4"
                        onClick={() => setOpen(false)}
                        onKeyDown={e => {
                            if (e.key === "Escape") setOpen(false);
                        }}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-label={t("language.choose")}
                            className="w-full max-w-sm max-h-[85vh] flex flex-col rounded-xl border border-white/10 bg-[#1a2234] shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                                <h2 className="text-white text-sm font-bold">{t("language.choose")}</h2>
                                <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-white" aria-label={t("table.close")}>
                                    <FaTimes size={14} />
                                </button>
                            </div>
                            <ul className="overflow-y-auto py-1">
                                {LANGUAGES.map(l => (
                                    <li key={l.code}>
                                        <button
                                            type="button"
                                            role="menuitemradio"
                                            aria-checked={l.code === language}
                                            lang={l.code}
                                            onClick={() => choose(l.code)}
                                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 ${l.code === language ? "text-white font-semibold" : "text-gray-300"}`}
                                        >
                                            <span>{l.name}</span>
                                            {l.code === language && <FaCheck size={12} className="text-blue-400" />}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <p className="px-4 py-2.5 border-t border-white/10 text-[11px] text-gray-400">{t("language.partial")}</p>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
};
