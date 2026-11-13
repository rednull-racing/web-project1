"use client";

import { useEffect, useState } from "react";
import { fetchGetReplyList } from "../api/comment";
import { Comment } from "../itemPageTypes";
import styles from "./comment.module.css";
import { CommentDataDiv } from "./commentDataDiv";
import { CommentText } from "./commentText";
import { DeleteComment } from "./deleteComment";
import { Like } from "./like";
import { Pin } from "./pin";
import { ProfileImage } from "./profileImage";
import { ReportFloat } from "./reportFloat";

type Props = {
    parentId: string;
    page: "normal" | "admin";
    loggedIn: boolean;
    sellerMe?: boolean;
    optimisticComments?: Comment[];
    refreshTrigger?: number;
};

export const ReplyList = ({ parentId, page, loggedIn, sellerMe, optimisticComments = [], refreshTrigger }: Props) => {
    const [comments, setComments] = useState<Comment[]>([]);

    useEffect(() => {
        const fetchComment = async () => {
            try {
                const data = await fetchGetReplyList({ parentId, sellerMe, page });

                setComments(data.commentList);
            } catch {}
        };

        fetchComment();
    }, [parentId, page, refreshTrigger]);

    const allComments = [...optimisticComments, ...comments];

    const isOptimistic = (id: string) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    };

    return (
        <>
            <section className={styles.replyListWrapper}>
                {allComments?.map((comment) => {
                    if (!comment) return null;
                    const optimistic = isOptimistic(String(comment.id));

                    return (
                        <section className={styles.commentListSection} key={comment.id}>
                            <section className={styles.commentFlex}>
                                <ProfileImage user={comment.User} />
                                <div className={styles.commentMain}>
                                    {comment.pin && <Pin />}

                                    <CommentDataDiv comment={comment} />
                                    <CommentText comment={comment} page={page} />

                                    <div className={styles.commentEditDiv}>
                                        {!optimistic && (
                                            <>
                                                <Like comment={comment} loggedIn={loggedIn} />
                                                <ReportFloat comment={comment} page={page} />

                                                {comment.isMyComment && <DeleteComment comment={comment} page={page} />}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </section>
                    );
                })}
            </section>
        </>
    );
};
