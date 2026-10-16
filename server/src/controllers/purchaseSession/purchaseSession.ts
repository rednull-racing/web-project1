import type { NextFunction, Request, Response } from "express-serve-static-core";
import { getPurchaseSessionAddressUseCase } from "../../usecases/purchaseSession/getAddress.js";
import { getPurchaseSessionNameUseCase } from "../../usecases/purchaseSession/getName.js";
import { postPurchaseSessionUseCase } from "../../usecases/purchaseSession/post.js";

// POST /purchase-session/:id
// summary: 購入セッションデータ作成
// page: /item
export const purchaseSessionPostByItemIdController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const itemId = Number(req.params.id);

        const purchaseSessionId = await postPurchaseSessionUseCase({ itemId, userId });

        res.status(200).json({ purchaseSessionId });
    } catch (err) {
        next(err);
    }
};

// GET /purchase-session/:id/address
// summary: 購入セッション配送先住所取得
// page: /edit/address/purchase/[id]
export const getPurchaseSessionAddressController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const purchaseSessionId = Number(req.params.id);
        const userId = req.user!.id;

        const data = await getPurchaseSessionAddressUseCase({ purchaseSessionId, userId });

        res.status(200).json({ data });
    } catch (err) {
        next(err);
    }
};

// GET /purchase-session/:id/name
// summary: 購入セッション配送先氏名取得
// page: /edit/name/purchase/[id]
export const getPurchaseSessionNameController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const purchaseSessionId = Number(req.params.id);
        const userId = req.user!.id;

        const data = await getPurchaseSessionNameUseCase({ purchaseSessionId, userId });

        res.status(200).json({ data });
    } catch (err) {
        next(err);
    }
};
