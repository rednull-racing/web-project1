import { AppError } from "../../../errors.js";
import { getMyShopSignupHasBankAccount } from "../../../services/shopSignup/query.js";

type Params = {
    shopSignupId: number;
    userId: number;
};

// GET /shop-signup/:id/bank-account
// summary: ショップ登録口座情報取得
// page: /edit/account/shop/signup/[id]
export const getShopSignupBankAccountUseCase = async ({ shopSignupId, userId }: Params) => {
    // shopSignup取得
    const shopSignup = await getMyShopSignupHasBankAccount({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    const data = shopSignup.BankAccount;
    if (!data) throw new AppError("BANK_ACCOUNT_NOT_FOUND", 404);

    return data;
};
