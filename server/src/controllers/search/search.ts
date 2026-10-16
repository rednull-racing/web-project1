import type { NextFunction, Request, Response } from "express-serve-static-core";
import { getSearchHistoryUseCase } from "../../usecases/search/getSearchHistory.js";

// GET /search/history
// summary: 検索履歴取得
// page: header
export const searchGetHistoryController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const sortedData = await getSearchHistoryUseCase({ userId });

        res.status(200).json({ sortedData });
    } catch (err) {
        next(err);
    }
};
