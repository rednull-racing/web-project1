"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./profile.module.css";
import { Res } from "./profileTypes";

type Props = {
    data: Res;
};

export const Introduction = ({ data }: Props) => {
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);
    const [contentHeight, setContentHeight] = useState(0);
    const textRef = useRef<HTMLParagraphElement>(null);
    const text = data.user.user_introduction || "";

    useEffect(() => {
        const el = textRef.current;
        if (el) {
            setContentHeight(el.scrollHeight);
            setOverflowing(el.scrollHeight > el.clientHeight);
        }
    }, [text]);

    return (
        <div className={styles.introductionDiv}>
            <p
                ref={textRef}
                className={`${styles.introduction} ${!expanded ? styles.clamp : ""}`}
                style={{
                    maxHeight: expanded ? `${contentHeight}px` : "6rem",
                    transition: "max-height 0.3s ease",
                }}
            >
                {text}
            </p>
            {overflowing && (
                <button type="button" onClick={() => setExpanded(!expanded)} className={styles.moreButton}>
                    {expanded ? "閉じる" : "...もっと見る"}
                </button>
            )}
        </div>
    );
};
