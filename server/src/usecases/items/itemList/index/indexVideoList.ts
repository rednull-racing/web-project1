import { Op } from "sequelize";
import { getIndexVideosWithCount } from "../../../../services/items/index.js";
import type { ItemWhere } from "../../../../types/serviceType/items.js";

type Params = {
    userId: number | null;
    page: number;
    limit: number;
};

// GET /items?type=""&page=number&view="index"&limit=number(&pageUserId=${id})
// summary: 商品リスト取得
// page: /lp・/など
export const getIndexVideosUseCase = async ({ userId, page, limit }: Params) => {
    const where: ItemWhere = { status: "active" };
    if (userId) {
        where.seller_id = { [Op.ne]: userId };
    }

    const offset = (page - 1) * limit;

    const { items, totalCount } = await getIndexVideosWithCount({ where, limit, offset });

    return {
        items,
        totalPages: Math.ceil(totalCount / limit),
    };
};
