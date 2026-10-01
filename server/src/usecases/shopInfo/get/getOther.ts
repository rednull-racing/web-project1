import { AppError } from "../../../errors.js";
import { getMyShopOther } from "../../../services/shopInfo/query.js";

type Params = {
    shopId: number;
    userId: number;
};

// GET /shop-info/:id/other
// summary: その他ショップ情報取得
// page: /edit/shop/other/[id]
export const getShopOtherUseCase = async ({ shopId, userId }: Params) => {
    // shopInfo取得
    const shop = await getMyShopOther({ shopId, userId });

    if (!shop) throw new AppError("SHOP_NOT_FOUND", 404);

    return shop;
};
