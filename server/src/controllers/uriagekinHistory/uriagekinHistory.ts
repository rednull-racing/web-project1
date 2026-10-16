import type { NextFunction, Request, Response } from "express-serve-static-core";
import { getMyUriagekinHistoryUseCase } from "../../usecases/uriagekinHistory/getMyUriagekinHistory.js";
import { GetUriagekinHistoryQuery } from "../../validators/query/uriagekinHistory.js";

// GET /uriagekin-history?limit=number(&cursor="")
// summary: 売上金履歴取得
// page: /history/uriagekin
export const uriagekinHistoryGetRootController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;

        const query = req.validatedQuery as GetUriagekinHistoryQuery;

        const { limit, cursor } = query;

        const { history, hasMore, nextCursor } = await getMyUriagekinHistoryUseCase({ userId, limit, cursor });

        res.status(200).json({ history, hasMore, nextCursor });
    } catch (err) {
        next(err);
    }
};
