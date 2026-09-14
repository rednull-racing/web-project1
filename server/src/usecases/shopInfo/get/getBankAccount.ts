import { AppError } from "../../../errors.js";
import { getMyShopHasBankAccount } from "../../../services/shopInfo/query.js";

type Params = {
    shopId: number;
    userId: number;
};

// GET /shop-info/:id/bank-account
// summary: ショップ口座情報取得
// page: /edit/account/shop/[id]
export const getBankAccountUseCase = async ({ shopId, userId }: Params) => {
    const shop = await getMyShopHasBankAccount({ shopId, userId });

    if (!shop) throw new AppError("SHOP_NOT_FOUND", 404);

    const data = shop.BankAccount;
    if (!data) throw new AppError("BANK_ACCOUNT_NOT_FOUND", 404);

    return data;
};
