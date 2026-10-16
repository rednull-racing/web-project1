import { AppError } from "../../../errors.js";
import { getComFreeOptionAll } from "../../../services/comOrFreeOption/comOrFreeOption.js";
import { getMyShopHasComFree } from "../../../services/shopInfo/query.js";

type Params = {
    shopId: number;
    userId: number;
};

// GET /shop-info/:id/com-free
// summary: 事業形態取得
// page: /edit/shop/com-free/[id]
export const getShopComFreeUseCase = async ({ shopId, userId }: Params) => {
    const shop = await getMyShopHasComFree({ shopId, userId });

    if (!shop) throw new AppError("SHOP_NOT_FOUND", 404);

    const comFree = await getComFreeOptionAll();

    return { shop, comFree };
};
