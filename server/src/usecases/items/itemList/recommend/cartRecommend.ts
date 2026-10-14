import { literal, Op } from "sequelize";
import { AppError } from "../../../../errors.js";
import { getCartRecommendItems } from "../../../../services/items/index.js";
import type { ItemWhere } from "../../../../types/serviceType/items.js";

type Params = {
    userId: number | null;
};

// GET /items/recommend?view="cart"(&itemId=number)
// summary: レコメンドリスト取得
// page: /item-list/cart
export const getCartRecommendUseCase = async ({ userId }: Params) => {
    if (!userId) throw new AppError("INVALID_USER_ID", 401);

    const where: ItemWhere = {
        status: "active",
        seller_id: { [Op.ne]: userId },
        id: {
            [Op.notIn]: literal(`(
                SELECT "item_id"
                FROM "cart"
                WHERE "user_id" = ${userId}
            )`),
        },
    };

    return await getCartRecommendItems({ where });
};
