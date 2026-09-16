import { AppError } from "../../../errors.js";
import { getMyShopSignupHasConName } from "../../../services/shopSignup/query.js";

type Params = {
    shopSignupId: number;
    userId: number;
};

// GET /shop-info/:id/con-name
// summary: 担当者氏名取得
// page: /edit/name/shop/con-name/signup/[id]
export const getShopSignupConNameUseCase = async ({ shopSignupId, userId }: Params) => {
    // shopSignup取得
    const shopSignup = await getMyShopSignupHasConName({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    const name = shopSignup.ContactName;
    if (!name) throw new AppError("NAME_NOT_FOUND", 404);

    return name;
};
