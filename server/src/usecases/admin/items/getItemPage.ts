import { AppError } from "../../../errors.js";
import { countItemPageComment } from "../../../services/comment/comment.js";
import { countItemLike } from "../../../services/itemLike/itemLike.js";
import { countItemReport } from "../../../services/itemReport/itemReport.js";
import { getAdminItemPage } from "../../../services/items/index.js";
import { getMeHighlight } from "../../../services/users/query.js";

type Params = {
    itemId: number;
    userId: number;
};

// GET /admin/items/:id/item-page
// summary: 管理者用商品ページデータ取得
// page: /item/admin/[id]
export const getAdminItemPageUseCase = async ({ itemId, userId }: Params) => {
    // item取得
    const item = await getAdminItemPage({ itemId });

    if (!item) throw new AppError("ITEM_NOT_FOUND", 404);

    // like関連取得
    const likeCount = await countItemLike({ itemId });

    // コメント数取得
    const commentCount = await countItemPageComment({ itemId });

    // 報告数取得
    const reportCount = await countItemReport({ itemId });

    // 自分のユーザー情報取得
    const me = await getMeHighlight({ userId });

    return {
        item,
        likeCount,
        commentCount,
        reportCount,
        me,
    };
};
