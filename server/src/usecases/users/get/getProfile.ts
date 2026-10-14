import { Op } from "sequelize";
import { AppError } from "../../../errors.js";
import { getProfileVideosWithCount } from "../../../services/items/index.js";
import { getProfileUser } from "../../../services/users/query.js";
import type { ItemWhere } from "../../../types/serviceType/items.js";

type Params = {
    userId: number;
    page: number;
    limit: number;
};

// GET /:id/profile?page=number&limit=number
// summary: プロフィール表示データ取得
// page: /profile/[id]
export const getProfileUseCase = async ({ userId, page, limit }: Params) => {
    // user取得
    const user = await getProfileUser({ userId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    const hasShop = !!user.ShopInfo;

    // 商品リスト取得
    const where: ItemWhere = {
        status: { [Op.in]: ["active", "soldout"] },
        seller_id: userId,
    };

    const offset = (page - 1) * limit;

    const { items, totalCount } = await getProfileVideosWithCount({ where, limit, offset });

    return {
        user,
        hasShop,
        items,
        hasItemCount: totalCount,
        totalPages: Math.ceil(totalCount / limit),
    };
};
