"use client";

import { useEffect, useRef, useState } from "react";
import { fetchCommentSortAdd } from "../api/comment";
import { Comment } from "../itemPageTypes";
import styles from "./comment.module.css";

type Props = {
    comment: Comment;
    page: "normal" | "admin";
};

export const CommentText = ({ comment, page }: Props) => {
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);
    const [contentHeight, setContentHeight] = useState(0);
    const textRef = useRef<HTMLParagraphElement>(null);
    const text = comment.text || "";

    useEffect(() => {
        const el = textRef.current;
        if (el) {
            setOverflowing(el.scrollHeight > el.clientHeight);
            setContentHeight(el.scrollHeight);
        }
    }, [text]);

    const expand = async () => {
        setExpanded(!expanded);
        if (comment.pin || expanded || page === "admin") return;

        fetchCommentSortAdd(comment.id, 2);
    };

    return (
        <>
            <p
                ref={textRef}
                className={`${styles.text} ${!expanded ? styles.clamp : ""}`}
                style={{
                    maxHeight: expanded ? `${contentHeight}px` : "5.2rem",
                    transition: "max-height 0.3s ease",
                }}
            >
                {text}
            </p>
            {overflowing && (
                <button type="button" onClick={expand} className={styles.moreButton}>
                    {expanded ? "閉じる" : "...もっと見る"}
                </button>
            )}
        </>
    );
};
