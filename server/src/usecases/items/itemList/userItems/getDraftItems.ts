import { Op } from "sequelize";
import { getUserItemsStatusList } from "../../../../services/items/index.js";
import type { ItemWhere } from "../../../../types/serviceType/items.js";

type Params = {
    page: number;
    userId: number;
    keyword?: string;
};

// /users/me/items?type="draft"(&page=number&status=""&keyword="search")
// summary: 下書き商品リスト取得
// page: /item-list/draft
export const getDraftItemsUseCase = async ({ page, userId, keyword }: Params) => {
    const limit = 20;
    const offset = (page - 1) * limit;

    const where: ItemWhere = {
        seller_id: userId,
    };

    if (keyword) {
        where.search_text = {
            [Op.iLike]: `%${keyword}%`,
        };
    }

    const { itemList, totalCount } = await getUserItemsStatusList({ where, limit, offset });

    return {
        itemList,
        totalPages: Math.ceil(totalCount / limit),
    };
};
