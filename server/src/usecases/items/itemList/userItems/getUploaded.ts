import { Op } from "sequelize";
import { getUserItemsUploadedList } from "../../../../services/items/index.js";
import type { ItemWhere } from "../../../../types/serviceType/items.js";

type Params = {
    page: number;
    userId: number;
    status?: string;
    keyword?: string;
};

// /users/me/items?type="uploaded"(&page=number&status=""&keyword="search")
// summary: 出品した商品リスト取得
// page: /item-list/uploaded
export const getUploadedItemsUseCase = async ({ page, userId, status, keyword }: Params) => {
    const limit = 20;
    const offset = (page - 1) * limit;

    const where: ItemWhere = {
        seller_id: userId,
    };

    // status分岐
    if (status === "active" || status === "soldout") {
        where.status = status;
    } else {
        // デフォルト
        where.status = { [Op.in]: ["active", "soldout"] };
    }

    if (keyword) {
        where.search_text = {
            [Op.iLike]: `%${keyword}%`,
        };
    }

    const { itemList, totalCount } = await getUserItemsUploadedList({ where, limit, offset });

    return {
        itemList,
        totalPages: Math.ceil(totalCount / limit),
    };
};
