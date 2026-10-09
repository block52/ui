import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { focusRing } from "./focusRing";

export interface SelectOption<T extends string = string> {
    value: T;
    label: string;
    /** Muted second line under the label. */
    description?: string;
    disabled?: boolean;
}

interface SelectProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: ReadonlyArray<SelectOption<T>>;
    id?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    disabled?: boolean;
    /** Shown when `value` matches no option. */
    placeholder?: string;
    /** Extra classes for the trigger button (e.g. `w-auto` in a toolbar). */
    className?: string;
    /** Which edge of the trigger the list lines up with. */
    align?: "start" | "end";
}

const MENU_GAP = 6;
const MENU_MAX_HEIGHT = 320;
const VIEWPORT_MARGIN = 12;
const MENU_MIN_WIDTH = 200;

interface MenuPosition {
    top: number;
    left: number;
    minWidth: number;
    maxWidth: number;
    maxHeight: number;
}

/** Where to put the list: under the trigger, or above it when there is more room there. */
const computePosition = (trigger: DOMRect, align: "start" | "end", viewportHeight: number, viewportWidth: number): MenuPosition => {
    const below = viewportHeight - trigger.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const above = trigger.top - MENU_GAP - VIEWPORT_MARGIN;
    const placeAbove = below < 200 && above > below;
    const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, placeAbove ? above : below));
    const maxWidth = Math.max(0, viewportWidth - 2 * VIEWPORT_MARGIN);
    const minWidth = Math.min(Math.max(trigger.width, MENU_MIN_WIDTH), maxWidth);
    const preferredLeft = align === "end" ? trigger.right - minWidth : trigger.left;
    const left = Math.min(Math.max(VIEWPORT_MARGIN, preferredLeft), Math.max(VIEWPORT_MARGIN, viewportWidth - minWidth - VIEWPORT_MARGIN));
    return {
        top: placeAbove ? trigger.top - MENU_GAP - maxHeight : trigger.bottom + MENU_GAP,
        left,
        minWidth,
        maxWidth,
        maxHeight
    };
};

/**
 * Themed single-choice dropdown that looks like the network dropdown in the navbar.
 * Replaces the native <select>, whose popup is drawn by the OS and ignores our light/dark theme.
 * The list renders in a portal so cards with overflow-hidden and modals never clip it.
 */
export const Select = <T extends string>({
    value,
    onChange,
    options,
    id,
    disabled = false,
    placeholder = "Select…",
    className = "",
    align = "start",
    ...aria
}: SelectProps<T>): React.ReactElement => {
    const reactId = useId();
    const listId = `${reactId}-list`;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [position, setPosition] = useState<MenuPosition | null>(null);
    const typeahead = useRef({ text: "", timer: 0 });

    const selectedIndex = useMemo(() => options.findIndex(option => option.value === value), [options, value]);
    const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

    const enabledIndexes = useMemo(() => options.map((option, index) => (option.disabled ? -1 : index)).filter(index => index >= 0), [options]);

    const close = useCallback(() => setIsOpen(false), []);

    const open = useCallback(() => {
        if (disabled || options.length === 0) return;
        setActiveIndex(selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : (enabledIndexes[0] ?? -1));
        setIsOpen(true);
    }, [disabled, options, selectedIndex, enabledIndexes]);

    const choose = useCallback(
        (index: number) => {
            const option = options[index];
            if (!option || option.disabled) return;
            onChange(option.value);
            close();
            triggerRef.current?.focus();
        },
        [options, onChange, close]
    );

    const reposition = useCallback(() => {
        if (!triggerRef.current) return;
        setPosition(computePosition(triggerRef.current.getBoundingClientRect(), align, window.innerHeight, window.innerWidth));
    }, [align]);

    useLayoutEffect(() => {
        if (!isOpen) return;
        reposition();
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true);
        return () => {
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
        };
    }, [isOpen, reposition]);

    useEffect(() => {
        if (!isOpen) return;
        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            close();
        };
        document.addEventListener("mousedown", handleMouseDown);
        return () => document.removeEventListener("mousedown", handleMouseDown);
    }, [isOpen, close]);

    useEffect(() => {
        if (!isOpen || activeIndex < 0) return;
        menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView?.({ block: "nearest" });
    }, [isOpen, activeIndex, position]);

    useEffect(() => () => window.clearTimeout(typeahead.current.timer), []);

    const moveActive = (step: 1 | -1) => {
        if (enabledIndexes.length === 0) return;
        const at = enabledIndexes.indexOf(activeIndex);
        const next = at === -1 ? (step === 1 ? 0 : enabledIndexes.length - 1) : (at + step + enabledIndexes.length) % enabledIndexes.length;
        setActiveIndex(enabledIndexes[next]);
    };

    const runTypeahead = (char: string) => {
        window.clearTimeout(typeahead.current.timer);
        typeahead.current.text += char.toLowerCase();
        typeahead.current.timer = window.setTimeout(() => {
            typeahead.current.text = "";
        }, 600);
        const match = enabledIndexes.find(index => options[index].label.toLowerCase().startsWith(typeahead.current.text));
        if (match === undefined) return;
        if (isOpen) setActiveIndex(match);
        else onChange(options[match].value);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        switch (event.key) {
            case "ArrowDown":
            case "ArrowUp":
                event.preventDefault();
                if (!isOpen) open();
                else moveActive(event.key === "ArrowDown" ? 1 : -1);
                break;
            case "Home":
            case "End":
                if (!isOpen) break;
                event.preventDefault();
                setActiveIndex(event.key === "Home" ? enabledIndexes[0] : enabledIndexes[enabledIndexes.length - 1]);
                break;
            case "Enter":
            case " ":
                event.preventDefault();
                if (!isOpen) open();
                else choose(activeIndex);
                break;
            case "Escape":
                if (isOpen) {
                    // Closes the list only: keep the surrounding modal open.
                    event.preventDefault();
                    event.stopPropagation();
                    close();
                }
                break;
            case "Tab":
                if (isOpen) close();
                break;
            default:
                if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) runTypeahead(event.key);
        }
    };

    return (
        <>
            <button
                ref={triggerRef}
                id={id}
                type="button"
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listId : undefined}
                aria-activedescendant={isOpen && activeIndex >= 0 ? `${reactId}-opt-${activeIndex}` : undefined}
                aria-label={aria["aria-label"]}
                aria-labelledby={aria["aria-labelledby"]}
                disabled={disabled}
                onClick={() => (isOpen ? close() : open())}
                onKeyDown={handleKeyDown}
                className={`flex w-full items-center justify-between gap-2 h-11 px-3.5 rounded-xl border border-line-strong bg-surface-raised text-left text-sm transition-colors hover:border-ink-muted/60 disabled:opacity-50 disabled:cursor-not-allowed ${focusRing} ${
                    selected ? "text-ink" : "text-ink-muted"
                } ${className}`}
            >
                <span className="truncate">{selected ? selected.label : placeholder}</span>
                <svg
                    className={`w-4 h-4 flex-none text-ink-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen &&
                position &&
                createPortal(
                    <div
                        ref={menuRef}
                        id={listId}
                        role="listbox"
                        aria-label={aria["aria-label"]}
                        aria-labelledby={aria["aria-labelledby"]}
                        style={{ position: "fixed", top: position.top, left: position.left, minWidth: position.minWidth, maxWidth: position.maxWidth, maxHeight: position.maxHeight }}
                        className="z-[10050] overflow-y-auto p-2 rounded-2xl bg-surface-card border border-line shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
                    >
                        {options.map((option, index) => {
                            const isSelected = index === selectedIndex;
                            const isActive = index === activeIndex;
                            return (
                                <div
                                    key={option.value}
                                    id={`${reactId}-opt-${index}`}
                                    data-index={index}
                                    role="option"
                                    aria-selected={isSelected}
                                    aria-disabled={option.disabled || undefined}
                                    onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={() => choose(index)}
                                    className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl cursor-pointer transition-colors ${
                                        option.disabled ? "opacity-50 cursor-not-allowed" : isActive ? "bg-surface-hover" : isSelected ? "bg-brand/10" : ""
                                    }`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`flex-none w-[18px] h-[18px] rounded-full grid place-items-center border-2 ${isSelected ? "border-brand" : "border-line-strong"}`}
                                    >
                                        {isSelected && <span className="w-2 h-2 rounded-full bg-brand" />}
                                    </span>
                                    <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                                        <span className={`text-sm font-medium truncate ${isSelected ? "text-ink" : "text-ink-body"}`}>{option.label}</span>
                                        {option.description && <span className="text-xs text-ink-muted truncate">{option.description}</span>}
                                    </span>
                                </div>
                            );
                        })}
                    </div>,
                    document.body
                )}
        </>
    );
};
