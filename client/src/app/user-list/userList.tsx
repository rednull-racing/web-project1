"use client";

import { faCircleCheck, faSearch, faStore, faTag } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { useInfinitePagination } from "../../hooks/useInfinitePagination";
import { ApiError } from "../../lib/api/apiError";
import { fetchRemoveFollow } from "./api/follow";
import { getUserListApiKey } from "./apiKey";
import { FollowButton } from "./followButton";
import { User, UserListResponse } from "./types";
import styles from "./userList.module.css";

type Props = {
    loggedIn: boolean;
    id?: string;
    currentUserId: string;
    page: "follow" | "item-like" | "comment-like" | "dev";
    followTab?: "follow" | "follower" | null;
    myFollow?: boolean;
};

export const UserList = ({ loggedIn, id, currentUserId, page, followTab, myFollow }: Props) => {
    const [searchValue, setSearchValue] = useState("");

    // 無限スクロール
    const {
        items: userList,
        mutate,
        loadMoreRef,
    } = useInfinitePagination<UserListResponse, User>({
        apiKey: getUserListApiKey({ id, page, followTab, searchValue }),
        getItems: (page) => page.userList,
        hasMore: (page) => page.hasMore,
    });

    // フォロー解除
    const followRemove = async (userId: string) => {
        mutate((prev) => {
            if (!prev) return;

            return prev.map((page) => ({
                ...page,
                userList: page.userList.filter((user) => user.id !== userId),
            }));
        }, false);

        try {
            await fetchRemoveFollow(userId);

            mutate();
        } catch (err) {
            mutate();

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

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchValue(val);
    };

    return (
        <>
            <section className={styles.searchSection}>
                <input
                    type="text"
                    name="user_search"
                    placeholder="ユーザーネームを検索"
                    className={styles.searchInput}
                    value={searchValue}
                    onChange={onChange}
                    autoComplete="off"
                />
                <FontAwesomeIcon
                    icon={faSearch}
                    name="search_icon"
                    className={`
                ${styles.searchIcon} 
                ${searchValue.trim() ? styles.activeIcon : ""}
            `}
                />
            </section>

            {userList && userList?.length > 0 && (
                <section className={styles.userListSection}>
                    {userList.map((user) => (
                        <section key={user.id} className={styles.userSection}>
                            <Link href={`/profile/${user.id}`} className={styles.userImageNameFlex}>
                                <Image
                                    src={user.profile_image ?? "/default-profile.png"}
                                    alt="プロフィール画像"
                                    width={45}
                                    height={45}
                                    className={styles.image}
                                />

                                <div className={styles.nameBlock}>
                                    <p className={styles.userName}>{user.user_name}</p>

                                    <div className={styles.iconRow}>
                                        {user.honnin_verified && (
                                            <FontAwesomeIcon icon={faCircleCheck} className={styles.honninIcon} />
                                        )}
                                        {user.early_seller && (
                                            <FontAwesomeIcon icon={faTag} className={styles.earlyIcon} />
                                        )}
                                        {user.ShopInfo && (
                                            <FontAwesomeIcon icon={faStore} className={styles.shopIcon} />
                                        )}
                                    </div>
                                </div>
                            </Link>

                            {loggedIn && currentUserId !== user.id && (
                                <>
                                    {!(followTab === "follow" && myFollow) && <FollowButton user={user} />}

                                    {followTab === "follow" && myFollow && (
                                        <button
                                            type="button"
                                            className={styles.followRemoveButton}
                                            onClick={() => followRemove(user.id)}
                                        >
                                            削除
                                        </button>
                                    )}
                                </>
                            )}
                        </section>
                    ))}
                </section>
            )}

            {userList?.length === 0 && (
                <>
                    {searchValue.trim().length > 0 && <p className={styles.noUser}>ユーザーが見つかりません</p>}

                    {searchValue.trim().length === 0 && (
                        <p className={styles.noUser}>
                            {["item-like", "comment-like"].includes(page)
                                ? "いいねしたユーザーがいません"
                                : followTab === "follow"
                                  ? "フォロー中のユーザーがいません"
                                  : "フォロワーがいません"}
                        </p>
                    )}
                </>
            )}

            <div ref={loadMoreRef} />
        </>
    );
};
