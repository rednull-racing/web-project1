import { AppError } from "../../../errors.js";
import { getShopSignup3 } from "../../../services/shopSignup.js";

type Params = {
    userId: number;
    shopSignupId: number;
};

// GET /shop-signup/:id/3
// summary: ショップ口座登録ページ インプット表示データ取得
// page: /shop-signup/step3/[id]
export const getShopSignup3UseCase = async ({ userId, shopSignupId }: Params) => {
    // shopSignup取得
    const shopSignup = await getShopSignup3({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    return shopSignup;
};
