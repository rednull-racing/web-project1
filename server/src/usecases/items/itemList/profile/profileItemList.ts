import { Op } from "sequelize";
import { getProfileItemsWithCount } from "../../../../services/items/index.js";
import type { ItemWhere } from "../../../../types/serviceType/items.js";

type Params = {
    page: number;
    limit: number;
    pageUserId?: number;
};

// GET /items?type=""&page=number&view="profile"&limit=number(&pageUserId=${id})
// summary: 商品リスト取得
// page: /profile
export const getProfileItemsUseCase = async ({ page, limit, pageUserId }: Params) => {
    const where: ItemWhere = {
        status: { [Op.in]: ["active", "soldout"] },
        seller_id: pageUserId,
    };

    const offset = (page - 1) * limit;

    const { items, totalCount } = await getProfileItemsWithCount({ where, limit, offset });

    return {
        items,
        totalPages: Math.ceil(totalCount / limit),
    };
};
