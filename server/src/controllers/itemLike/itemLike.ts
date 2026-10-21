import type { NextFunction, Request, Response } from "express-serve-static-core";
import { addItemLikeUseCase } from "../../usecases/itemLike/add.js";
import { itemLikeCountUseCase } from "../../usecases/itemLike/count.js";
import { deleteItemLikeUseCase } from "../../usecases/itemLike/delete.js";
import { itemLikeStatusUseCase } from "../../usecases/itemLike/status.js";
import { getItemLikeUserListUseCase } from "../../usecases/itemLike/userList.js";
import { KeywordOptionalQuery } from "../../validators/query/keyword.js";

// POST /item-like/:id
// summary: いいね作成
// page: /item
export const itemLikePostByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        await addItemLikeUseCase({ itemId, userId });

        res.status(200).json({ isGood: true });
    } catch (err) {
        next(err);
    }
};

// DELETE /item-like/:id
// summary: いいね削除
// page: /item
export const itemLikeDeleteByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        await deleteItemLikeUseCase({ itemId, userId });

        res.status(200).json({ isGood: false });
    } catch (err) {
        next(err);
    }
};

// GET /item-like/:id/status
// summary: いいねステータス取得
// page: /item
export const itemLikeGetByIdStatusController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        const isGood = await itemLikeStatusUseCase({ itemId, userId });

        res.status(200).json({ isGood });
    } catch (err) {
        next(err);
    }
};

// GET /item-like/:id/count
// summary: いいね数取得
// page: /item
export const itemLikeGetByIdCountController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const itemId = Number(req.params.id);

        const count = await itemLikeCountUseCase({ itemId });

        res.status(200).json({ count });
    } catch (err) {
        next(err);
    }
};

// GET /item-like/:id/user(?keyword="")
// summary: いいねしたユーザーリスト取得
// page: /user-list/item-like/[id]
export const itemLikeGetByIdUserController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        const query = req.validatedQuery as KeywordOptionalQuery;
        const keyword = query.keyword;

        const userList = await getItemLikeUserListUseCase({ itemId, userId, keyword });

        res.status(200).json({ userList });
    } catch (err) {
        next(err);
    }
};
