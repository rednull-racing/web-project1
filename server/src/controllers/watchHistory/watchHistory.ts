import type { NextFunction, Request, Response } from "express-serve-static-core";
import { deleteWatchHistoryUseCase } from "../../usecases/watchHistory/delete.js";
import { getWatchItemListUseCase } from "../../usecases/watchHistory/getWatchItemList.js";
import type { GetWatchItemListQuery } from "../../validators/query/watchHistory.js";

// DELETE /watch-history/:id
// summary: 閲覧履歴削除
// page: /item-list/watch-history
export const watchHistoryDeleteByIdController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const itemId = Number(req.params.id);

        const userId = req.user!.id;

        await deleteWatchHistoryUseCase({ itemId, userId });

        res.status(200).json({ message: "閲覧履歴を削除しました" });
    } catch (err) {
        next(err);
    }
};

// GET /watch-history/item-list?page=number&status=""&keyword=""
// summary: 閲覧した商品リスト取得
// page: /item-list/watch-history
export const getWatchItemListController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { page, status, keyword } = req.validatedQuery as GetWatchItemListQuery;
        const { itemList, totalPages } = await getWatchItemListUseCase({ userId, page, status, keyword });
        res.status(200).json({ itemList, totalPages });
    } catch (error) {
        next(error);
    }
};
