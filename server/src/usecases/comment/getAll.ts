import { Comment } from "../../models/index.js";
import { countReply, getAllCommentsItemPage } from "../../services/comment/comment.js";
import { countCommentLike, getCommentLikeOne } from "../../services/commentLike/commentLike.js";
import { countCommentReport } from "../../services/commentReport/commentReport.js";
import { patchSortNumberAddUseCase } from "../items/sortNumber/sortNumber.js";

type Params = {
    itemId: number;
    userId: number | null;
    sellerMe: boolean;
    admin: boolean;
};

// GET /comment/:id?sellerMe=boolean(&admin=boolean)
// summary: コメント一覧取得
// page: /item
export const getAllCommentsUseCase = async ({ itemId, userId, sellerMe, admin }: Params) => {
    if (!sellerMe && !admin) {
        patchSortNumberAddUseCase({ itemId, number: 8, buzzNumber: 50 }).catch((err) => {
            console.error("patchSortNumberAdd error:", err);
        });
    }

    // コメント取得
    const commentList = await getAllCommentsItemPage({ itemId });

    const commentListWithExtras = await Promise.all(
        commentList.map(async (comment: InstanceType<typeof Comment>) => {
            const commentId = comment.id;

            const replyCount = await countReply({ commentId });

            const goodCount = await countCommentLike({ commentId });

            const commentData = comment.toJSON();
            commentData.replyCount = replyCount;
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
