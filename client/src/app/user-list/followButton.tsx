"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../lib/api/apiError";
import { fetchAddFollow, fetchRemoveFollow } from "./api/follow";
import styles from "./button.module.css";
import { User } from "./types";

type Props = {
    user: User;
};

export const FollowButton = ({ user }: Props) => {
    const [isFollowing, setIsFollowing] = useState(user.is_following);

    const add = async () => {
        const next = !isFollowing;

        setIsFollowing(next);

        try {
            await fetchAddFollow(user.id);
        } catch (err) {
            setIsFollowing(!next);

            if (err instanceof ApiError) {
                if (err.code === "ALREADY_FOLLOWING") {
                    toast.error("すでにフォローしています");
                } else {
                    toast.error("フォロー失敗しました");
                }

                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const remove = async () => {
        const next = !isFollowing;

        setIsFollowing(next);

        try {
            await fetchRemoveFollow(user.id);
        } catch (err) {
            setIsFollowing(!next);

            if (err instanceof ApiError) {
                if (err.code === "NOT_FOLLOWING") {
                    toast.error("フォローしていません");
                } else {
                    toast.error("フォロー解除に失敗しました");
                }

                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    return (
        <>
            {!isFollowing && (
                <button
                    type="button"
                    name="follow-button"
                    className={`${styles.followButton} ${styles.false}`}
                    onClick={add}
                >
                    フォロー
                </button>
            )}

            {isFollowing && (
                <button
                    type="button"
                    name="follow-button"
                    className={`${styles.followButton} ${styles.true}`}
                    onClick={remove}
                >
                    フォロー中
                </button>
            )}
        </>
    );
};
