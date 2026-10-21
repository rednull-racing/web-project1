import { AppError } from "../../errors.js";
import { createItemReport, getItemReportOption } from "../../services/itemReport/itemReport.js";
import { getItem, updateReportScore } from "../../services/items/index.js";
import { getUser } from "../../services/users/query.js";

type Params = {
    itemId: number;
    userId: number;
    optionId: number;
};

// POST /item-report/:id
// summary: item報告作成
// page: /report/item/[id]
export const createItemReportUseCase = async ({ itemId, userId, optionId }: Params) => {
    // idバリデーション
    if (isNaN(itemId) || isNaN(optionId)) {
        throw new AppError("INVALID_ID", 400);
    }

    // option取得
    const reportOption = await getItemReportOption({ optionId });

    if (!reportOption) throw new AppError("OPTION_NOT_FOUND", 404);

    // item取得
    const item = await getItem({ itemId });

    if (!item) throw new AppError("ITEM_NOT_FOUND", 404);

    // user取得
    const user = await getUser({ userId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    // ItemReport作成
    await createItemReport({
        data: {
            item_id: itemId,
            report_user_id: userId,
            option_id: optionId,
        },
    });

    // report_score更新
    const newReportScore = Number(item.report_score) + Number(user.report_trust_score);

    updateReportScore({
        item,
        data: {
            report_score: newReportScore,
        },
    }).catch((err) => {
        console.error("service updateReportScore error:", err);
    });
};
