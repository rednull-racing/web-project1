import { Op } from "sequelize";
import { getUserItemsWatchList } from "../../../../services/watchHistory/watchHistory.js";
import type { ItemWhere } from "../../../../types/serviceType/items.js";

type Params = {
    page: number;
    userId: number;
    keyword?: string;
};

// /users/me/items?type="watchHistory"(&page=number&status=""&keyword="search")
// summary: 閲覧履歴取得
// page: /item-list/watchHistory
export const getUserItemsWatchUseCase = async ({ page, userId, keyword }: Params) => {
    const limit = 20;
    const offset = (page - 1) * limit;

    const itemWhere: ItemWhere = {
        status: ["active", "soldout"],
    };

    if (keyword) {
        itemWhere.search_text = {
            [Op.iLike]: `%${keyword}%`,
        };
    }

    const { itemList, totalCount } = await getUserItemsWatchList({ userId, itemWhere, limit, offset });

    return {
        itemList,
        totalPages: Math.ceil(totalCount / limit),
    };
};
