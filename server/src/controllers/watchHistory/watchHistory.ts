import type { NextFunction, Request, Response } from "express-serve-static-core";
import { deleteWatchHistoryUseCase } from "../../usecases/watchHistory/delete.js";

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
