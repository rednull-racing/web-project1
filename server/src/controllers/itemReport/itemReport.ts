import type { NextFunction, Request, Response } from "express-serve-static-core";
import { createItemReportUseCase } from "../../usecases/itemReport/create.js";
import { getAllItemReportOptionsUseCase } from "../../usecases/itemReport/getAllOptions.js";
import { OptionIdBody } from "../../validators/body/report.js";

// POST /item-report/:id
// summary: item報告作成
// page: /report/item/[id]
export const itemReportPostByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        const body = req.validatedBody as OptionIdBody;
        const optionId = body.selected;

        await createItemReportUseCase({ itemId, userId, optionId });

        res.status(200).json({ message: "報告を作成しました" });
    } catch (err) {
        next(err);
    }
};

// GET /item-report/all-options
// summary: ItemReportOptions取得
// page: /report/item/[id]
export const itemReportGetAllOptionsController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const options = await getAllItemReportOptionsUseCase();

        res.status(200).json({ options });
    } catch (err) {
        next(err);
    }
};
