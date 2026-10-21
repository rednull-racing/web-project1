import { AppError } from "../../../errors.js";
import { countItemPageComment } from "../../../services/comment/comment.js";
import { countItemLike, getItemLikeOne } from "../../../services/itemLike/itemLike.js";
import { getItemPageData } from "../../../services/items/index.js";
import { getMeHighlight } from "../../../services/users/query.js";
import { ItemPageMode } from "../../../validators/query/items.js";

type Params = {
    itemId: number;
    userId: number | null;
    mode: ItemPageMode;
};

// GET /items/:id?mode=""
// summary: 商品ページ データ取得
// page: /item
export const getItemPageUseCase = async ({ itemId, userId, mode }: Params) => {
    // itemデータ取得
    const item = await getItemPageData({ itemId });

    if (!item || (mode === "normal" && !["active", "soldout"].includes(item.status))) {
        throw new AppError("ITEM_NOTFOUND", 404);
    }

    if (mode === "normal") {
        const sellerMe = userId === item.seller_id;

        // like関連取得
        const likeCount = await countItemLike({ itemId });

        let isLikeByMe = false;

        if (!sellerMe && userId) {
            const isLike = await getItemLikeOne({ itemId, userId });

            isLikeByMe = !!isLike;
        }

        // コメント数取得
        const commentCount = await countItemPageComment({ itemId });

        // 自分のユーザー情報取得
        let me = null;
        if (userId) {
            me = await getMeHighlight({ userId });
        }

        return {
            item,
            sellerMe,
            likeCount,
            isLikeByMe,
            commentCount,
            me,
        };
    }

    return {
        item,
        sellerMe: null,
        likeCount: null,
        isLikeByMe: null,
        commentCount: null,
        me: null,
    };
};
