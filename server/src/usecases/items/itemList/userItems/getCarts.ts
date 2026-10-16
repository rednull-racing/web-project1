import { Op } from "sequelize";
import { getUserItemsCartList } from "../../../../services/cart/cart.js";
import type { ItemWhere } from "../../../../types/serviceType/items.js";

type Params = {
    page: number;
    userId: number;
    keyword?: string;
};

// /users/me/items?type="cart"(&page=number&status=""&keyword="search")
// summary: カートリスト取得
// page: /item-list/cart
export const getUserItemsCartsUseCase = async ({ page, userId, keyword }: Params) => {
    const limit = 20;
    const offset = (page - 1) * limit;

    const itemWhere: ItemWhere = {
        status: "active",
    };

    if (keyword) {
        itemWhere.search_text = {
            [Op.iLike]: `%${keyword}%`,
        };
    }

    const { itemList, totalCount } = await getUserItemsCartList({ userId, itemWhere, limit, offset });

    return {
        itemList,
        totalPages: Math.ceil(totalCount / limit),
    };
};
