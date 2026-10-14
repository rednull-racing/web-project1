import { Op } from "sequelize";
import { getIndexRecommendItems } from "../../../../services/items/index.js";
import type { ItemWhere } from "../../../../types/serviceType/items.js";

type Params = {
    userId: number | null;
};

// GET /items/recommend?view="recommend"(&itemId=number)
// summary: レコメンドリスト取得
// page: /・/lp
export const getIndexRecommendUseCase = async ({ userId }: Params) => {
    const where: ItemWhere = {
        status: "active",
        recommend: true,
        ...(userId && { seller_id: { [Op.ne]: userId } }),
    };

    return await getIndexRecommendItems({ where });
};
