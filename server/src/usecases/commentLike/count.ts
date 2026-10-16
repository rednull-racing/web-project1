import { countCommentLike } from "../../services/commentLike/commentLike.js";

type Params = {
    commentId: number;
};

// GET /comment-like/:id/count
// summary: いいね数取得
// page: /item
export const countCommentLikeUseCase = async ({ commentId }: Params): Promise<number> => {
    const count = await countCommentLike({ commentId });

    return count;
};
