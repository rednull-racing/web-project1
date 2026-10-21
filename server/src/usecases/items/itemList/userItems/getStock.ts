import { Op } from "sequelize";
import { getUserItemsStockList } from "../../../../services/items/index.js";
import type { ItemWhere } from "../../../../types/serviceType/items.js";

type Params = {
    page: number;
    userId: number;
    keyword?: string;
};

// /users/me/items?type="stock"(&page=number&status=""&keyword="search")
// summary: 在庫リスト取得
// page: /item-list/stock
export const getStockItemsUseCase = async ({ page, userId, keyword }: Params) => {
    const limit = 20;
    const offset = (page - 1) * limit;

    const where: ItemWhere = {
        seller_id: userId,
        status: { [Op.in]: ["active", "soldout"] },
    };

    if (keyword) {
        where.search_text = {
            [Op.iLike]: `%${keyword}%`,
        };
    }

    const { itemList, totalCount } = await getUserItemsStockList({ where, limit, offset });

    return {
        itemList,
        totalPages: Math.ceil(totalCount / limit),
    };
};
