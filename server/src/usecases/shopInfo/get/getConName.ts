import { AppError } from "../../../errors.js";
import { getMyShopHasConName } from "../../../services/shopInfo/query.js";

type Params = {
    shopId: number;
    userId: number;
};

// GET /shop-info/:id/con-name
// summary: 担当者氏名取得
// page: /edit/name/shop/con-name/[id]
export const getConNameUseCase = async ({ shopId, userId }: Params) => {
    const shop = await getMyShopHasConName({ shopId, userId });

    if (!shop) throw new AppError("SHOP_NOT_FOUND", 404);

    const name = shop.ContactName;
    if (!name) throw new AppError("NAME_NOT_FOUND", 404);

    return name;
};
