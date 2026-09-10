import { AppError } from "../../../errors.js";
import { getMyShopSignupHasBankAccount } from "../../../services/shopSignup.js";
import { getUserHasBankAccount } from "../../../services/users/query.js";

type Params = {
    userId: number;
    shopSignupId: number;
};

// GET /shop-signup/:id/2
// summary: ショップ口座登録ページ インプット表示データ取得
// page: /shop-signup/step2/[id]
export const getShopSignup2UseCase = async ({ userId, shopSignupId }: Params) => {
    // shopSignup取得（確認用）
    const shopSignup = await getMyShopSignupHasBankAccount({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    // shopSignupのbankAccount取得
    let account = shopSignup.BankAccount ?? undefined;

    if (!account) {
        const user = await getUserHasBankAccount({ userId });

        if (!user) throw new AppError("USER_NOT_FOUND", 404);

        account = user.BankAccount;
    }

    if (!account) throw new AppError("BANK_ACCOUNT_NOT_FOUND", 404);

    return account;
};
