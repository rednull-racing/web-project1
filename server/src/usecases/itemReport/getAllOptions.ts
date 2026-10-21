import { AppError } from "../../errors.js";
import type { ItemReportOption } from "../../models/item_report_option.js";
import { getAllItemReportOptions } from "../../services/itemReport/itemReport.js";

// GET /item-report/all-options
// summary: ItemReportOptions取得
// page: /report/item/[id]
export const getAllItemReportOptionsUseCase = async (): Promise<ItemReportOption[]> => {
    const allOptions = await getAllItemReportOptions();

    if (allOptions.length === 0) {
        throw new AppError("ITEM_REPORT_OPTIONS_NOT_FOUND", 404);
    }

    return allOptions;
};
