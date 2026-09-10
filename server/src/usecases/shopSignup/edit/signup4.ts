import { AppError } from "../../../errors.js";
import { getMyShopSignup, updateShopSignupOption } from "../../../services/shopSignup.js";

type Params = {
    shopSignupId: number;
    userId: number;
    autoTrans: boolean;
    openInfo: boolean;
};

// PATCH /shop-signup/:id/option
// summary: ショップ登録オプション選択
// page: /shop-signup/step4/[id]
export const updateShopSignup4UseCase = async ({ shopSignupId, userId, autoTrans, openInfo }: Params) => {
    // shop取得
    const shopSignup = await getMyShopSignup({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    // db更新
    await updateShopSignupOption({
        shopSignup,
        data: {
            auto_trans: autoTrans,
            open_info: openInfo,
        },
    });
};
