import React from "react";
import { LoadingSpinner } from "../common";
import type { ActionButtonProps } from "./types";

export const ActionButton: React.FC<ActionButtonProps> = ({
    action,
    label,
    amount,
    icon,
    variant = "primary",
    loading,
    disabled,
    onClick,
    className = ""
}) => {
    const variantStyles: Record<string, string> = {
        primary: "btn-raise",
        secondary: "btn-check",
        danger: "btn-fold",
        success: "btn-call"
    };

    const baseClass = variantStyles[variant] || variantStyles.primary;

    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`${baseClass} ${className} flex items-center justify-center gap-1 rounded-btn border shadow-md backdrop-blur-sm transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed`}
            data-action={action}
        >
            {loading ? (
                <>
                    <LoadingSpinner size="sm" />
                    {label.toUpperCase()}...
                </>
            ) : (
                <>
                    {icon}
                    {label}
                    {amount && <span className="font-bold ml-1">${amount}</span>}
                </>
            )}
        </button>
    );
};
