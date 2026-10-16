import type { NextFunction, Request, Response } from "express-serve-static-core";
import { saleEditUseCase } from "../../usecases/sale/saleEdit.js";
import { saleStopUseCase } from "../../usecases/sale/saleStop.js";
import { SaleEditBody } from "../../validators/body/sale.js";

// PATCH /sale/:id/edit
// summary: セール開始
// page: /item
export const salePatchByIdEditController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const saleId = Number(req.params.id);
        const userId = req.user!.id;

        const body = req.validatedBody as SaleEditBody;

        await saleEditUseCase({ saleId, userId, body });

        res.status(200).json({ message: "値引きしました！" });
    } catch (err) {
        next(err);
    }
};

// PATCH /sale/:id/stop
// summary: セール終了
// page: /item
export const salePatchByIdStopController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const saleId = Number(req.params.id);
        const userId = req.user!.id;

        await saleStopUseCase({ saleId, userId });

        res.status(200).json({ message: "値引きを終了しました！" });
    } catch (err) {
        next(err);
    }
};
