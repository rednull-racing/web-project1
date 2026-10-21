import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { createPerfectDelete } from "../../../services/itemDeleteLogs/itemDeleteLogs.js";
import { destroyPerfectItem, getMyItem } from "../../../services/items/index.js";

type Params = {
    itemId: number;
    userId: number;
};

// DELETE /items/:id/perfect
// summary: 商品完全削除
// page: /item/deleted/[id]
export const deleteItemPerfectUseCase = async ({ itemId, userId }: Params) => {
    // Item取得
    const item = await getMyItem({ itemId, userId });
    if (!item) {
        throw new AppError("ITEM_NOT_FOUND", 404);
    }

    // データ編集
    await sequelize.transaction(async (t) => {
        await createPerfectDelete({ itemId, userId, transaction: t });

        await destroyPerfectItem({ item, transaction: t });
    });
};
