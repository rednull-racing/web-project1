import type { NextFunction, Request, Response } from "express-serve-static-core";
import { getMyPointsHistoryUseCase } from "../../usecases/pointsHistory/getMyPointsHistory.js";
import { GetPointsHistoryQuery } from "../../validators/query/pointsHistory.js";

// GET /points-history?limit=number(&cursor="")
// summary: ポイント履歴取得
// page: /history/points
export const pointsHistoryGetRootController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;

        const query = req.validatedQuery as GetPointsHistoryQuery;

        const { limit, cursor } = query;

        const { history, hasMore, nextCursor } = await getMyPointsHistoryUseCase({ userId, limit, cursor });

        res.status(200).json({ history, hasMore, nextCursor });
    } catch (err) {
        next(err);
    }
};
