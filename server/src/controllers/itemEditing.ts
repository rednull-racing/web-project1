import type { NextFunction, Request, Response } from "express-serve-static-core";
import { createItemEditingUseCase } from "../usecases/itemEditing/createItemEditing.js";

// POST /item-editing
// summary: 商品データ作成
// page: /upload/before
export const createItemEditingController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const itemId = await createItemEditingUseCase({ userId});

        res.status(200).json({ itemId });
    } catch (err) {
        next(err);
    }
};
