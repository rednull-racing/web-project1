import { Op } from "sequelize";
import { getUserItemsLikesList } from "../../../../services/itemLike.js";
import type { ItemWhere } from "../../../../types/serviceType/items.js";

type Params = {
    page: number;
    userId: number;
    keyword?: string;
};

// /users/me/items?type="like"(&page=number&status=""&keyword="search")
// summary: いいねした商品リスト取得
// page: /item-list/like
export const getUserItemsLikesUseCase = async ({ page, userId, keyword }: Params) => {
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

    const { itemList, totalCount } = await getUserItemsLikesList({ userId, itemWhere, limit, offset });

    return {
        itemList,
        totalPages: Math.ceil(totalCount / limit),
    };
};
