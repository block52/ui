import React from "react";
import { Link } from "react-router-dom";

export type PillVariant = "primary" | "outline" | "ghost";
export type PillSize = "sm" | "md" | "lg";

const variantClass: Record<PillVariant, string> = {
    primary: "bg-brand text-white hover:bg-brand/90 border border-transparent",
    outline: "border border-line-strong text-ink hover:bg-ink hover:text-surface-page hover:border-ink",
    ghost: "border border-transparent text-ink-soft hover:bg-surface-hover hover:text-ink"
};

const sizeClass: Record<PillSize, string> = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-5 text-sm",
    lg: "h-12 px-6 text-[15px]"
};

const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-light";

/** Class string for a pill, for elements that cannot use PillButton (e.g. <a target="_blank">). */
export const pillClass = (variant: PillVariant = "primary", size: PillSize = "md", extra = ""): string =>
    `${base} ${variantClass[variant]} ${sizeClass[size]} ${extra}`;

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: PillVariant;
    size?: PillSize;
}

/** Rounded-full button: primary (solid brand), outline, or ghost. */
export const PillButton: React.FC<PillButtonProps> = ({ variant = "primary", size = "md", className = "", type = "button", ...rest }) => (
    <button type={type} className={pillClass(variant, size, className)} {...rest} />
);

interface PillLinkProps {
    to: string;
    children: React.ReactNode;
    variant?: PillVariant;
    size?: PillSize;
    className?: string;
    "aria-label"?: string;
}

/** A router Link styled as a pill. */
export const PillLink: React.FC<PillLinkProps> = ({ to, children, variant = "outline", size = "sm", className = "", ...rest }) => (
    <Link to={to} className={pillClass(variant, size, className)} {...rest}>
        {children}
    </Link>
);
