import { AppError } from "../../errors.js";
import { createComment } from "../../services/comment/comment.js";
import { getItem } from "../../services/items/index.js";
import { patchSortNumberAddUseCase } from "../items/sortNumber/sortNumber.js";
import { patchCommentSortNumberAddUseCase } from "./patchSortNumber.js";

type Params = {
    userId: number;
    itemId: number;
    commentText: string;
    commentLength: number;
    sellerMe: boolean;
    parentId?: number;
};

// POST /comment/:id?sellerMe=boolean(&parentId=number)
// summary: コメント作成
// page: /item
export const uploadCommentUseCase = async ({
    userId,
    itemId,
    commentText,
    commentLength,
    sellerMe,
    parentId,
}: Params) => {
    // 親コメント取得、sort_number add
    if (parentId && parentId > 0) {
        patchCommentSortNumberAddUseCase({ commentId: parentId, number: 150 }).catch((err) => {
            console.error("usecase patchCommentSortNumberAdd error:", err);
        });
    }

    // item取得
    const item = await getItem({ itemId });

    if (!item) throw new AppError("ITEM_NOT_FOUND", 404);

    const commentData = {
        text: commentText,
        sort_number: 500 + commentLength,
        item_id: itemId,
        user_id: userId,
        ...(parentId && parentId > 0 ? { parent_comment_id: parentId } : {}),
        ...(sellerMe ? { pin: true } : {}),
    };

    // データ操作
    const comment = await createComment({ data: commentData });

    if (item.status === "active" && !sellerMe) {
        patchSortNumberAddUseCase({ itemId, number: 25, buzzNumber: 120 }).catch((err) => {
            console.error("patchSortNumberAdd error:", err);
        });
    }

    return comment;
};
