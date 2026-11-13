/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { faCommentDots } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import { KeyedMutator } from "swr";
import { Comment, Item, User } from "../itemPageTypes";
import styles from "./comment.module.css";
import { CommentDataDiv } from "./commentDataDiv";
import { CommentForm } from "./commentForm";
import { CommentText } from "./commentText";
import { DeleteComment } from "./deleteComment";
import { Like } from "./like";
import { Pin } from "./pin";
import { ProfileImage } from "./profileImage";
import { ReplyList } from "./replyList";
import { ReportFloat } from "./reportFloat";

type Props = {
    id: string;
    sellerMe?: boolean;
    comments: Comment[];
    page: "normal" | "admin";
    loggedIn: boolean;
    item: Item;
    me: User | null;
    mutate: KeyedMutator<Comment[]>;
};

export const CommentList = ({ id, sellerMe, comments, page, loggedIn, item, me, mutate }: Props) => {
    const [replyVisible, setReplyVisible] = useState<{ [key: string]: boolean }>({});
    const [optimisticReplies, setOptimisticReplies] = useState<{ [parentId: string]: Comment[] }>({});
    const [replyRefreshTrigger, setReplyRefreshTrigger] = useState<{ [parentId: string]: number }>({});

    const toggleReplyVisible = (commentId: string) => {
        setReplyVisible((prev) => ({
            ...prev,
            [commentId]: !prev[commentId],
        }));
    };

    const isOptimistic = (id: string) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    };

    // CommentFormに渡すmutateをラップ
    const replyMutate = (parentId: string) => (updater?: any) => {
        if (typeof updater === "function") {
            // 返信　楽観的更新
            setOptimisticReplies((prev) => ({
                ...prev,
                [parentId]: updater(prev[parentId] ?? []),
            }));

            // replyCount + 1
            mutate(
                (current: Comment[] = []) =>
                    current.map((c) =>
                        String(c.id) === String(parentId) ? { ...c, replyCount: c.replyCount + 1 } : c,
                    ),
                false,
            );
        } else {
            // revalidate時はoptimisticクリア＋ReplyListの再フェッチをトリガー
            setOptimisticReplies((prev) => ({ ...prev, [parentId]: [] }));
            setReplyRefreshTrigger((prev) => ({ ...prev, [parentId]: (prev[parentId] ?? 0) + 1 }));
        }
    };

    return (
        <>
            <section className={styles.commentListWrapper}>
                {comments?.map((comment) => {
                    if (!comment) return null;
                    const commentId = comment.id;
                    const isVisibleReply = replyVisible[commentId] ?? false;
                    const optimistic = isOptimistic(String(commentId));

                    return (
                        <section className={styles.commentListSection} key={commentId}>
                            <section className={styles.commentFlex}>
                                <ProfileImage user={comment.User} />
                                <div className={styles.commentMain}>
                                    {comment.pin && <Pin />}

                                    <CommentDataDiv comment={comment} />
                                    <CommentText comment={comment} page={page} />

                                    <div className={styles.commentEditDiv}>
                                        {/* 仮コメントのときは返信ボタン・Good・Report・Delete非表示 */}
                                        {!optimistic && (
                                            <>
                                                <div
                                                    className={styles.replyDiv}
                                                    onClick={() => toggleReplyVisible(commentId)}
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faCommentDots}
                                                        className={styles.replyIcon}
                                                    />
                                                    <p className={styles.replyCount}>
                                                        {comment.replyCount.toLocaleString()}件の返信
                                                    </p>
                                                </div>

                                                <Like comment={comment} loggedIn={loggedIn} />
                                                <ReportFloat comment={comment} page={page} />

                                                {(comment.isMyComment || page === "admin") && (
                                                    <DeleteComment comment={comment} page={page} />
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {!optimistic && (
                                <section className={`${styles.replySection} ${isVisibleReply ? styles.replyOpen : ""}`}>
                                    {page === "normal" && (
                                        <CommentForm
                                            id={id}
                                            sellerMe={sellerMe}
                                            parentId={commentId}
                                            loggedIn={loggedIn}
                                            item={item}
                                            me={me}
                                            mutate={replyMutate(commentId)}
                                        />
                                    )}

                                    <ReplyList
                                        parentId={commentId}
                                        page={page}
                                        loggedIn={loggedIn}
                                        sellerMe={sellerMe}
                                        optimisticComments={optimisticReplies[commentId] ?? []}
                                        refreshTrigger={replyRefreshTrigger[commentId] ?? 0}
                                    />
                                </section>
                            )}
                        </section>
                    );
                })}
            </section>
        </>
    );
};
