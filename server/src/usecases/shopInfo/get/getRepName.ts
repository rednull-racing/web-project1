import { AppError } from "../../../errors.js";
import { getMyShopHasRepName } from "../../../services/shopInfo/query.js";

type Params = {
    shopId: number;
    userId: number;
};

// GET /shop-info/:id/rep-name
// summary: 代表者氏名取得
// page: /edit/name/shop/rep-name/[id]
export const getRepNameUseCase = async ({ shopId, userId }: Params) => {
    const shop = await getMyShopHasRepName({ shopId, userId });

    if (!shop) throw new AppError("SHOP_NOT_FOUND", 404);

    const name = shop.RepresentativeName;
    if (!name) throw new AppError("NAME_NOT_FOUND", 404);

    return { shop };
};
