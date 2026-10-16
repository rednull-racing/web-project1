import { AppError } from "../../errors.js";
import { destroyItemLike, getItemLikeOne } from "../../services/itemLike/itemLike.js";
import { patchSortNumberDecreaseUseCase } from "../items/sortNumber/sortNumber.js";

type Params = {
    itemId: number;
    userId: number;
};

// DELETE /item-like/:id
// summary: いいね削除
// page: /item
export const deleteItemLikeUseCase = async ({ itemId, userId }: Params) => {
    // itemLike取得
    const data = await getItemLikeOne({ itemId, userId });

    if (!data) {
        throw new AppError("NOT_LIKE_ITEM", 409, "いいねしていません");
    }

    // itemLike削除
    await destroyItemLike({ data });

    // sort_number非同期
    const number = 50;
    const buzzNumber = 200;

    patchSortNumberDecreaseUseCase({ itemId, number, buzzNumber }).catch((err) => {
        console.error("usecase patchSortNumberDecrease error:", err);
    });
};
