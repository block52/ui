import React from "react";
import { ActionButton } from "./ActionButton";
import type { ShowdownButtonsProps } from "./types";
import { useLanguage } from "../../i18n/useLanguage";

export const ShowdownButtons: React.FC<ShowdownButtonsProps> = ({
    canMuck,
    canShow,
    loading,
    onMuck,
    onShow
}) => {
    const { t } = useLanguage();
    return (
        <div className="flex justify-center gap-2 mb-2 lg:mb-3">
            {canMuck && (
                <ActionButton
                    action="muck"
                    label={t("action.muck")}
                    loading={loading === "muck"}
                    onClick={onMuck}
                    variant="secondary"
                    className="px-4 lg:px-6 py-2 lg:py-3 text-sm lg:text-base"
                />
            )}
            {canShow && (
                <ActionButton
                    action="show"
                    label={t("action.show")}
                    loading={loading === "show"}
                    onClick={onShow}
                    variant="success"
                    className="px-4 lg:px-6 py-2 lg:py-3 text-sm lg:text-base"
                />
            )}
        </div>
    );
};
