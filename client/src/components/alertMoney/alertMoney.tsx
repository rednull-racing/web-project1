"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import styles from "./styles.module.css";
import { PointLots, UriagekinLots } from "./types";

type Props = {
    pointLots?: PointLots;
    uriagekinLots?: UriagekinLots;
    mode: "points" | "uriagekin";
};

export const AlertMoney = ({ pointLots, uriagekinLots, mode }: Props) => {
    if (mode === "points" && !pointLots) return null;
    if (mode === "uriagekin" && !uriagekinLots) return null;
    if (pointLots && uriagekinLots) return null;

    // alert残り日数
    const setAfterDate = (date: Date | string): string => {
        const now = new Date();
        const d = typeof date === "string" ? new Date(date) : date;
        const diffMs = d.getTime() - now.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffDay > 1) {
            return `${diffDay}日`;
        } else {
            return "残りわずか";
        }
    };

    let expiresAt: string | null = null;
    let alertValue: string | null = null;

    if (mode === "points" && pointLots) {
        expiresAt = setAfterDate(pointLots.expires_at);
        alertValue = `${pointLots.alertPoints.toLocaleString()}pt`;
    } else if (mode === "uriagekin" && uriagekinLots) {
        expiresAt = setAfterDate(uriagekinLots.expires_at);
        alertValue = `売上金${uriagekinLots.alertUriagekin.toLocaleString()}円`;
    }

    return (
        <div className={styles.alertFlex}>
            <div className={styles.alertIconBox}>
                <IconAlertTriangle size={18} stroke={2} className={styles.alertIcon} />
            </div>

            <p className={styles.alertText}>
                あと<span className={styles.alertBold}>{expiresAt}</span>で
                <span className={styles.alertBold}>{alertValue}</span>
                が失効します
            </p>
        </div>
    );
};
