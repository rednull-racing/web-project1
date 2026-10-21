import type { NextFunction, Request, Response } from "express-serve-static-core";
import { createTransferPointsUseCase } from "../../usecases/transfer/createPoints.js";
import { createTransferRequestUseCase } from "../../usecases/transfer/createRequest.js";
import { getTransferDetailUseCase } from "../../usecases/transfer/getDetail.js";
import { getTransferHistoryUseCase } from "../../usecases/transfer/getTransferHistory.js";
import { TransferBody } from "../../validators/body/transfer.js";
import { GetTransferHistoryQuery } from "../../validators/query/transfer.js";

// POST /transfer/request
// summary: 振込申請データ作成
// page: /transfer/request
export const transferPostRequestController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const body = req.validatedBody as TransferBody;
        const { value, limit } = body;

        const transId = await createTransferRequestUseCase({ userId, requestValue: value, limit });

        res.status(200).json({
            message: "振込申請が完了しました。",
            transId,
        });
    } catch (err) {
        next(err);
    }
};

// POST /transfer/points
// summary: 売上金ポイント変換
// page: /transfer/points
export const transferPostPointsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const body = req.validatedBody as TransferBody;
        const { value, limit } = body;

        await createTransferPointsUseCase({ userId, value, limit });

        res.status(200).json({ message: "売上金をポイント変換しました。" });
    } catch (err) {
        next(err);
    }
};

// GET /transfer/history?limit=number(&cursor="")
// summary: 振込申請履歴取得
// page: /transfer/history
export const transferGetHistoryController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const query = req.validatedQuery as GetTransferHistoryQuery;
        const { limit, cursor } = query;

        const { history, hasMore, nextCursor } = await getTransferHistoryUseCase({ userId, limit, cursor });

        res.status(200).json({ history, hasMore, nextCursor });
    } catch (err) {
        next(err);
    }
};

// GET /transfer/:id/detail
// summary: 振込申請詳細表示
// page: /transfer/detail/[id]
export const transferGetByIdDetailController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const transId = Number(req.params.id);
        const userId = req.user!.id;

        const transfer = await getTransferDetailUseCase({ transId, userId });

        res.status(200).json({ transfer });
    } catch (err) {
        next(err);
    }
};
