import { AppError } from "../../../../errors.js";
import { updateShopSignupAny } from "../../../../services/shopSignup/command.js";
import { getMyShopSignup } from "../../../../services/shopSignup/query.js";
import { ShopSignupEditBody } from "../../../../validators/body/shopSignup.js";
import { buildUpdateData } from "./utils/buildUpdateData.js";

type Params = {
    shopSignupId: number;
    userId: number;
    updateData: ShopSignupEditBody;
};

// PATCH /shop-signup/:id/edit
// summary: ショップ登録確認ページ インプット編集
// page: /shop-signup/step5/[id]
export const updateShopSignupEditUseCase = async ({ shopSignupId, userId, updateData }: Params) => {
    // shop取得
    const shopSignup = await getMyShopSignup({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    const data = buildUpdateData(updateData);

    // db更新
    await updateShopSignupAny({
        shopSignup,
        data,
    });
};
