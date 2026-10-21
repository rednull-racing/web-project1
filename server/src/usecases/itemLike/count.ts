import { countItemLike } from "../../services/itemLike/itemLike.js";

type Params = {
    itemId: number;
};

// GET /item-like/:id/count
// summary: いいね数取得
// page: /item
export const itemLikeCountUseCase = async ({ itemId }: Params) => {
    const count = await countItemLike({ itemId });

    return count;
};
