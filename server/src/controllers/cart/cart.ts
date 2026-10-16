import type { NextFunction, Request, Response } from "express-serve-static-core";
import { addCartUseCase } from "../../usecases/cart/add.js";
import { deleteCartUseCase } from "../../usecases/cart/delete.js";
import { cartStatusUseCase } from "../../usecases/cart/status.js";

// POST /cart/:id
// summary: カート追加
// page: /item
export const cartPostByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);

        const userId = req.user!.id;

        await addCartUseCase({ itemId, userId });

        res.status(200).json({ message: "カートに追加しました" });
    } catch (err) {
        next(err);
    }
};

// DELETE /cart/:id
// summary: カート削除
// page: /item
export const cartDeleteByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);

        const userId = req.user!.id;

        await deleteCartUseCase({ itemId, userId });

        res.status(200).json({ message: "カートから削除しました" });
    } catch (err) {
        next(err);
    }
};

// GET /cart/:id/status
// summary: カートステータス取得
// page: /item
export const cartGetByIdStatusController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);

        const userId = req.user!.id;

        const status = await cartStatusUseCase({ itemId, userId });

        res.status(200).json({ status });
    } catch (err) {
        next(err);
    }
};
