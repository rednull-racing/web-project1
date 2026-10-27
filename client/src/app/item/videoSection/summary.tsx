"use client";

import { useEffect, useRef, useState } from "react";
import { fetchItemSortAdd } from "../api/itemSection";
import styles from "../itemCommon.module.css";

type Props = {
    data: {
        itemId: string | null;
        summary: string;
        soldout: boolean;
    };
    sellerMe?: boolean;
    normalPage?: boolean;
};

export const Summary = ({ data, sellerMe, normalPage }: Props) => {
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);
    const [summaryHeight, setSummaryHeight] = useState(0);
    const summaryRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        const el = summaryRef.current;
        if (el) {
            setSummaryHeight(el.scrollHeight);
            setOverflowing(el.scrollHeight > el.clientHeight);
        }
    }, [data.summary]);

    const expand = async () => {
        setExpanded(!expanded);
        if (data.soldout || !data.itemId || expanded || sellerMe || !normalPage) return;

        fetchItemSortAdd(data.itemId, 5);
    };

    return (
        <>
            <p className={styles.semiTitle}>ABOUT THE VIDEO</p>
            <div className={styles.summaryDiv}>
                <p
                    ref={summaryRef}
                    className={`${styles.summary} ${!expanded ? styles.clamp : ""}`}
                    style={{
                        maxHeight: expanded ? `${summaryHeight}px` : "calc(1.75em * 2)",
                        transition: "max-height 0.3s ease",
                    }}
                >
                    {data.summary}
                </p>
                {overflowing && (
                    <button type="button" onClick={expand} className={styles.moreButton}>
                        {expanded ? "閉じる" : "...もっと見る"}
                    </button>
                )}
            </div>
        </>
    );
};
