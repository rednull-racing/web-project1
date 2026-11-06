import { getItemTrashListUseCase } from "../../usecases/itemTrash/getItemTrashList.js";
import type { GetItemTrashListQuery } from "../../validators/query/itemTrash.js";
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

// GET /item-trash/list?page=number&keyword=""
// summary: 削除した商品リスト取得
// page: /item-list/trash
export const getItemTrashListController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { page, keyword } = req.validatedQuery as GetItemTrashListQuery;
        const result = await getItemTrashListUseCase({ userId, page, keyword });
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
