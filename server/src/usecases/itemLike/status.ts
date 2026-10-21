import { getItemLikeOne } from "../../services/itemLike/itemLike.js";

type Params = {
    itemId: number;
    userId: number;
};

// GET /item-like/:id/status
// summary: いいねステータス取得
// page: /item
export const itemLikeStatusUseCase = async ({ itemId, userId }: Params) => {
    const isGood = await getItemLikeOne({ itemId, userId });

    return !!isGood;
};
