import type { NextFunction, Request, Response } from "express-serve-static-core";
import { createItemTrashUseCase } from "../../usecases/itemTrash/createItemTrash.js";
import type { CreateItemTrashBody } from "../../validators/body/itemTrash.js";

// POST /item-trash
// summary: 論理削除商品作成
// page: /item/[id]
export const createItemTrashController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { itemId } = req.validatedBody as CreateItemTrashBody;
        await createItemTrashUseCase({ userId, itemId });
        res.status(201).json({ message: "商品を削除しました" });
    } catch (error) {
        next(error);
    }
};
