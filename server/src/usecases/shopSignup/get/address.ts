import { AppError } from "../../../errors.js";
import { getMyShopSignupHasAddress } from "../../../services/shopSignup/query.js";

type Params = {
    shopSignupId: number;
    userId: number;
};

// GET /shop-signup/:id/address
// summary: 会社所在地取得
// page: /edit/address/shop/signup/[id]
export const getShopSignupAddressUseCase = async ({ shopSignupId, userId }: Params) => {
    // shopSignup取得
    const shopSignup = await getMyShopSignupHasAddress({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    const data = shopSignup.Address;
    if (!data) throw new AppError("ADDRESS_NOT_FOUND", 404);

    return data;
};
