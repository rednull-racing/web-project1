"use client";

import { useEffect, useRef, useState } from "react";
import { fetchItemSortAdd } from "../api/itemSection";
import styles from "../itemCommon.module.css";

type Props = {
    data: {
        itemId: string | null;
        detail: string;
        soldout: boolean;
    };
    sellerMe?: boolean;
    normalPage?: boolean;
};

export const Detail = ({ data, sellerMe, normalPage }: Props) => {
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setoverflowing] = useState(false);
    const [detailHeight, setDetailHeight] = useState(0);
    const detailRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        const el = detailRef.current;
        if (el) {
            setoverflowing(el.scrollHeight > el.clientHeight);
            setDetailHeight(el.scrollHeight);
        }
    }, [data.detail]);

    const expand = async () => {
        setExpanded(!expanded);
        if (data.soldout || !data.itemId || expanded || sellerMe || !normalPage) return;

        fetchItemSortAdd(data.itemId, 5);
    };

    return (
        <>
            <p className={styles.semiTitle}>DETAIL</p>
            <div className={styles.summaryDiv}>
                <p
                    ref={detailRef}
                    className={`${styles.summary} ${!expanded ? styles.clamp : ""}`}
                    style={{
                        maxHeight: expanded ? detailHeight : "calc(1.75em * 2)",
                        transition: "max-height 0.3s ease",
                    }}
                >
                    {data.detail}
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
