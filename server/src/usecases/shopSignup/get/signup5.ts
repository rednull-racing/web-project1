import { AppError } from "../../../errors.js";
import { getShopSignup5 } from "../../../services/shopSignup.js";

type Params = {
    userId: number;
    shopSignupId: number;
};

// GET /shop-signup/:id/5
// summary: ショップ登録確認ページデータ取得
// page: /shop-signup/step5/[id]
export const getShopSignup5UseCase = async ({ userId, shopSignupId }: Params) => {
    // shopSignup取得
    const shopSignup = await getShopSignup5({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    return shopSignup;
};
