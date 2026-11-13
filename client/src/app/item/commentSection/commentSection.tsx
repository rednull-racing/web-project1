"use client";

import { getAccessToken } from "@/lib/getAccessToken";
import { faCommentDots } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import useSWR from "swr";
import { Item, User } from "../itemPageTypes";
import styles from "./comment.module.css";
import { CommentForm } from "./commentForm";
import { CommentList } from "./commentList";

type Props = {
    id: string;
    sellerMe?: boolean;
    commentCount?: number;
    page: "normal" | "admin";
    loggedIn: boolean;
    item: Item;
    me: User | null;
};

const fetcher = async (url: string) => {
    try {
        const accessToken = await getAccessToken();

        const res = await fetch(url, {
            method: "GET",
            headers: {
                ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            },
            cache: "no-store",
        });

        if (!res.ok) {
            throw new Error("コメント取得失敗");
        }

        const data = await res.json();
        return data.commentList;
    } catch {}
};

export const CommentSection = ({ id, sellerMe, commentCount, page, loggedIn, item, me }: Props) => {
    const [visible, setVisible] = useState(false);

    const { data: comments, mutate } = useSWR(
        visible
            ? `${process.env.NEXT_PUBLIC_API_URL}/comment/${id}?sellerMe=${sellerMe}${page === "admin" ? "&admin=true" : ""}`
            : null,
        fetcher,
    );

    return (
        <>
            <div className={styles.commentShowDiv} onClick={() => setVisible(!visible)}>
                <FontAwesomeIcon icon={faCommentDots} className={styles.commentShowIcon} />
                <p className={styles.commentShowText}>
                    {visible ? "閉じる" : "コメントを見る"}（{commentCount?.toLocaleString()}）
                </p>
            </div>

            <div className={`${styles.commentBody} ${visible ? styles.open : ""}`}>
                {page === "normal" && (
                    <CommentForm id={id} sellerMe={sellerMe} loggedIn={loggedIn} item={item} me={me} mutate={mutate} />
                )}
                <CommentList
                    id={id}
                    sellerMe={sellerMe}
                    comments={comments}
                    page={page}
                    loggedIn={loggedIn}
                    item={item}
                    me={me}
                    mutate={mutate}
                />
            </div>
        </>
    );
};
