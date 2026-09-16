import { AppError } from "../../../errors.js";
import { getMyShopHasAddress } from "../../../services/shopInfo/query.js";

type Params = {
    shopId: number;
    userId: number;
};

// GET /shop-info/:id/address
// summary: 会社所在地取得
// page: /edit/address/shop/[id]
export const getShopAddressUseCase = async ({ shopId, userId }: Params) => {
    const shop = await getMyShopHasAddress({ shopId, userId });

    if (!shop) throw new AppError("SHOP_NOT_FOUND", 404);

    const data = shop.Address;
    if (!data) throw new AppError("ADDRESS_NOT_FOUND", 404);

    return data;
};
