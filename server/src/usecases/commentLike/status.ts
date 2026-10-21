import { getCommentLikeOne } from "../../services/commentLike/commentLike.js";

type Params = {
    commentId: number;
    userId: number;
};

// GET /comment-like/:id/status
// summary: いいねステータス取得
// page: /item
export const commentLikeStatusUseCase = async ({ commentId, userId }: Params) => {
    const isGood = await getCommentLikeOne({ commentId, userId });

    return !!isGood;
};
