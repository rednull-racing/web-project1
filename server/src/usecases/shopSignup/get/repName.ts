import { AppError } from "../../../errors.js";
import { getMyShopSignupHasRepName } from "../../../services/shopSignup/query.js";

type Params = {
    shopSignupId: number;
    userId: number;
};

// GET /shop-signup/:id/rep-name
// summary: 代表者氏名取得
// page: /edit/name/shop/rep-name/signup/[id]
export const getShopSignupRepNameUseCase = async ({ shopSignupId, userId }: Params) => {
    // shopSignup取得
    const shopSignup = await getMyShopSignupHasRepName({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    const name = shopSignup.RepresentativeName;
    if (!name) throw new AppError("NAME_NOT_FOUND", 404);

    return shopSignup;
};
