import { Comment } from "../../models/index.js";
import { getAllReply } from "../../services/comment/comment.js";
import { countCommentLike, getCommentLikeOne } from "../../services/commentLike/commentLike.js";
import { countCommentReport } from "../../services/commentReport/commentReport.js";
import { patchCommentSortNumberAddUseCase } from "./patchSortNumber.js";

type Params = {
    parentCommentId: number;
    userId: number | null;
    sellerMe: boolean;
    admin: boolean;
};

// GET /comment/:id/reply?sellerMe=boolean(&admin=boolean)
// summary: 返信リスト取得
// page: /item
export const getAllRepliesUseCase = async ({ parentCommentId, userId, sellerMe, admin }: Params) => {
    if (!sellerMe && !admin) {
        patchCommentSortNumberAddUseCase({ commentId: parentCommentId, number: 10 }).catch((err) => {
            console.error("patchCommentSortNumberAdd error:", err);
        });
    }

    // コメント取得
    const commentList = await getAllReply({ commentId: parentCommentId });

    const commentListWithExtras = await Promise.all(
        commentList.map(async (comment: InstanceType<typeof Comment>) => {
            const commentId = comment.id;

            const goodCount = await countCommentLike({ commentId });

            const commentData = comment.toJSON();
            commentData.goodCount = goodCount;
            commentData.isMyComment = userId !== null && comment.user_id === userId;

            let isGood = null;
            if (userId) {
                isGood = await getCommentLikeOne({ commentId, userId });
            }

            commentData.isGoodByMe = !!isGood;

            if (admin) {
                const reportCount = await countCommentReport({ commentId });

                commentData.reportCount = reportCount;
            }

            return commentData;
        }),
    );

    return commentListWithExtras;
};
