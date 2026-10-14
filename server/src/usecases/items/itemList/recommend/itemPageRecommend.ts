import { Op } from "sequelize";
import { AppError } from "../../../../errors.js";
import { getItemPageRecommendItems, getItemWithCategory } from "../../../../services/items/index.js";
import type { ItemWhere } from "../../../../types/serviceType/items.js";

type Params = {
    itemId?: number;
    userId: number | null;
};

// GET /items/recommend?view="itemPage"(&itemId=number)
// summary: レコメンドリスト取得
// page: /item
export const getItemPageRecommendUseCase = async ({ itemId, userId }: Params) => {
    if (!itemId) throw new AppError("ITEMID_INVALID", 400);

    const item = await getItemWithCategory({ itemId });

    if (!item) throw new AppError("ITEM_NOT_FOUND", 404);

    const baseCategory = item.Category;

    const targetParentId = baseCategory.parent_id ?? baseCategory.id;

    const where: ItemWhere = {
        id: { [Op.ne]: itemId },
        status: "active",
    };

    if (userId) {
        where.seller_id = userId === item.seller_id ? userId : { [Op.ne]: userId };
    }

    const categoryRequired = userId !== item.seller_id;

    return await getItemPageRecommendItems({ where, targetParentId, categoryRequired });
};
