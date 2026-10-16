import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { createBankAccount } from "../../../services/bankAccount/bankAccount.js";
import { getBankOne } from "../../../services/banks/banks.js";
import { getBranchOne } from "../../../services/branches/branches.js";
import { createNotification } from "../../../services/notification/notification.js";
import { getMyShop } from "../../../services/shopInfo/query.js";
import { createShopEdit } from "../../../services/shopInfoEdit/command.js";
import { BankBody } from "../../../validators/body/bankAccount.js";

type Params = {
    shopId: number;
    userId: number;
    body: BankBody;
};

// POST /shop-info-edit/:id/bank-account
// summary: 口座情報変更リクエスト
// page: /edit/account/shop/[id]
export const createBankAccountUseCase = async ({ shopId, userId, body }: Params) => {
    // body
    const { bankName, branch, accountType, accountNumber, meigi } = body;

    // shopInfo取得
    const shop = await getMyShop({ shopId, userId });

    if (!shop) throw new AppError("SHOP_NOT_FOUND", 404);

    // 銀行名照合
    const matchedBank = await getBankOne({ bankName });

    if (!matchedBank) throw new AppError("INVALID_BANK", 400);

    // 支店名照合
    const matchedBranch = await getBranchOne({ bankCode: matchedBank.code, branch });

    if (!matchedBranch) throw new AppError("INVALID_BRANCH", 400);

    // db登録
    await sequelize.transaction(async (t) => {
        const newAccount = await createBankAccount({
            data: {
                bank_code: matchedBank.code,
                bank_name: matchedBank.normalize?.name || matchedBank.name,
                branch_code: matchedBranch.code,
                branch: matchedBranch.normalize?.name || matchedBranch.name,
                account_type: accountType,
                account_number: accountNumber,
                meigi: meigi,
            },
            transaction: t,
        });

        await createShopEdit({
            data: {
                user_id: userId,
                shop_info_id: shopId,
                account_id: newAccount.id,
            },
            transaction: t,
        });
    });

    // お知らせ作成
    createNotification({
        data: {
            read_user_id: userId,
            message:
                "口座情報の変更を受け付けました。審査には1~2週間程度お時間を要する場合がございます。審査完了までしばらくお待ちください。",
            type: "SHOP_EDIT",
        },
    }).catch((err) => {
        console.error("service createNotification error:", err);
    });
};
