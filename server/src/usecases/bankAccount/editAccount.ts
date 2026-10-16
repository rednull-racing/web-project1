import { AppError } from "../../errors.js";
import { getMyBankAccount, updateBankAccount } from "../../services/bankAccount/bankAccount.js";
import { getBankOne } from "../../services/banks/banks.js";
import { getBranchOne } from "../../services/branches/branches.js";
import { BankBody } from "../../validators/body/bankAccount.js";

type Params = {
    userId: number;
    accountId: number;
    body: BankBody;
};

// PATCH /bank-account/:id
// summary: 口座情報変更
// page: /edit/account
export const editAccountUseCase = async ({ userId, accountId, body }: Params) => {
    // body
    const { bankName, branch, accountType, accountNumber, meigi } = body;

    // 銀行名照合
    const matchedBank = await getBankOne({ bankName });

    if (!matchedBank) throw new AppError("INVALID_BANK", 400);

    // 支店名照合
    const matchedBranch = await getBranchOne({ bankCode: matchedBank.code, branch });

    if (!matchedBranch) throw new AppError("INVALID_BRANCH", 400);

    // 口座情報取得
    const account = await getMyBankAccount({ accountId, userId });

    if (!account) throw new AppError("BANK_ACCOUNT_NOT_FOUND", 404);

    // db更新
    await updateBankAccount({
        account,
        data: {
            bank_code: matchedBank.code,
            bank_name: matchedBank.normalize?.name || matchedBank.name,
            branch_code: matchedBranch.code,
            branch: matchedBranch.normalize?.name || matchedBranch.name,
            account_type: accountType,
            account_number: accountNumber,
            meigi: meigi,
        },
    });
};
