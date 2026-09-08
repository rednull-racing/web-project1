import { AppError } from "../../../errors.js";
import { getMyShopSignup } from "../../../services/shopSignup.js";

type Params = {
    shopSignupId: number;
    userId: number;
};

// PATCH /shop-signup/:id/signup5
// summary: ショップ登録 確定
// page: /shop-signup/step5/[id]
export const updateShopSignup5UseCase = async ({ shopSignupId, userId }: Params) => {
    // shop取得
    const shopSignup = await getMyShopSignup({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    // 既存承認待ちshop削除
};
