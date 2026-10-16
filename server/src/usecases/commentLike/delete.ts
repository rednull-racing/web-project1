import { destroyCommentLike, getCommentLikeOne } from "../../services/commentLike/commentLike.js";
import { AppError } from "../../errors.js";
import { patchCommentSortNumberDecreaseUseCase } from "../comment/patchSortNumber.js";

type Params = {
    commentId: number;
    userId: number;
};

// DELETE /comment-like/:id
// summary: いいね削除
// page: /item
export const deleteCommentLikeUseCase = async ({ commentId, userId }: Params) => {
    // CommentLike取得
    const data = await getCommentLikeOne({ commentId, userId });

    if (!data) {
        throw new AppError("NOT_LIKE_COMMENT", 409);
    }

    // CommentLike削除
    await destroyCommentLike({ data });

    // sort_number非同期
    const number = 100;

    patchCommentSortNumberDecreaseUseCase({ commentId, number }).catch((err) => {
        console.error("usecase patchCommentSortNumberAdd error:", err);
    });
};
