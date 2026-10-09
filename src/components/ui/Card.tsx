import React from "react";

interface CardProps {
    children: React.ReactNode;
    className?: string;
    as?: "section" | "div" | "article" | "aside";
}

export const Card: React.FC<CardProps> = ({ children, className = "", as: Tag = "section" }) => (
    <Tag className={`bg-surface-card border border-line rounded-2xl overflow-hidden ${className}`}>{children}</Tag>
);

interface CardHeaderProps {
    title: React.ReactNode;
    /** Secondary text beside the title, e.g. a club name. */
    subtitle?: React.ReactNode;
    /** Controls on the right: icon buttons, filters, search. */
    actions?: React.ReactNode;
    level?: "h2" | "h3";
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, subtitle, actions, level: Heading = "h2" }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
            <Heading className="m-0 text-[17px] font-semibold text-ink">{title}</Heading>
            {subtitle && <span className="text-ink-muted text-sm">{subtitle}</span>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
);
