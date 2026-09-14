import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { createBankAccount } from "../../../services/bankAccount.js";
import { getBankOne } from "../../../services/banks.js";
import { getBranchOne } from "../../../services/branches.js";
import { getMyShopSignup, updateShopSignupBankAccount } from "../../../services/shopSignup.js";
import { BankBody } from "../../../validators/body/bankAccount.js";

type Params = {
    shopSignupId: number;
    userId: number;
    body: BankBody;
};

// PATCH /shop-signup/:id/bank-account
// summary: ショップ口座情報作成
// page: /shop-signup/step2
export const updateShopSignup2UseCase = async ({ shopSignupId, userId, body }: Params) => {
    // ショップ取得
    const shopSignup = await getMyShopSignup({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    // body
    const { bankName, branch, accountType, accountNumber, meigi } = body;

    // 銀行名照合
    const matchedBank = await getBankOne({ bankName });

    if (!matchedBank) throw new AppError("INVALID_BANK", 400);

    // 支店名照合
    const matchedBranch = await getBranchOne({ bankCode: matchedBank.code, branch });

    if (!matchedBranch) throw new AppError("INVALID_BRANCH", 400);

    // 口座情報作成
    await sequelize.transaction(async (t) => {
        const newAccount = await createBankAccount({
            data: {
                bank_code: matchedBank.code,
                bank_name: matchedBank.normalize?.name || matchedBank.name,
                branch_code: matchedBranch.code,
                branch: matchedBranch.normalize?.name || matchedBranch.name,
                account_number: accountNumber,
                meigi: meigi,
                account_type: accountType,
            },
            transaction: t,
        });

        await updateShopSignupBankAccount({
            shopSignup,
            data: {
                account_id: newAccount.id,
            },
            transaction: t,
        });
    });
};
