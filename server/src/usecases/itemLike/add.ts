import { AppError } from "../../errors.js";
import { createItemLike, getItemLikeOne } from "../../services/itemLike/itemLike.js";
import { patchSortNumberAddUseCase } from "../items/sortNumber/sortNumber.js";

type Params = {
    itemId: number;
    userId: number;
};

// POST /item-like/:id
// summary: いいね作成
// page: /item
export const addItemLikeUseCase = async ({ itemId, userId }: Params) => {
    // itemLike取得
    const data = await getItemLikeOne({ itemId, userId });

    if (data) {
        throw new AppError("ALREADY_LIKE_ITEM", 409, "すでにいいね済みです");
    }

    // itemLike作成
    await createItemLike({ itemId, userId });

    // sort_number非同期
    const number = 50;
    const buzzNumber = 200;

    patchSortNumberAddUseCase({ itemId, number, buzzNumber }).catch((err) => {
        console.error("usecase patchSortNumberAdd error:", err);
    });
};
