import { BankBody } from "../../../validators/body/bankAccount.js";

type Params = {
    shopSignupId: number;
    userId: number;
    body: BankBody;
};

// PATCH /shop-signup/:id/edit-bank-account
// summary: ショップ口座情報作成
// page: /edit/account/shop/signup/[id]
export const updateShopSignupBankAccountUseCase = async ({ shopSignupId, userId, body }: Params) => {
    // shopSignup取得
}
