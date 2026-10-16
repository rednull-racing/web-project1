import type { NextFunction, Request, Response } from "express-serve-static-core";
import { addCommentLikeUseCase } from "../../usecases/commentLike/add.js";
import { countCommentLikeUseCase } from "../../usecases/commentLike/count.js";
import { deleteCommentLikeUseCase } from "../../usecases/commentLike/delete.js";
import { commentLikeStatusUseCase } from "../../usecases/commentLike/status.js";
import { getCommentLikeUserListUseCase } from "../../usecases/commentLike/userList.js";
import { KeywordOptionalQuery } from "../../validators/query/keyword.js";

// POST /comment-like/:id
// summary: いいね作成
// page: /item
export const commentLikePostByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const commentId = Number(req.params.id);

        const userId = req.user!.id;

        await addCommentLikeUseCase({ commentId, userId });

        res.status(200).json({ isGood: true });
    } catch (err) {
        next(err);
    }
};

// DELETE /comment-like/:id
// summary: いいね削除
// page: /item
export const commentLikeDeleteByIdController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const commentId = Number(req.params.id);

        const userId = req.user!.id;

        await deleteCommentLikeUseCase({ commentId, userId });

        res.status(200).json({ isGood: false });
    } catch (err) {
        next(err);
    }
};

// GET /comment-like/:id/status
// summary: いいねステータス取得
// page: /item
export const commentLikeGetByIdStatusController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const commentId = Number(req.params.id);

        const userId = req.user!.id;

        const isGood = await commentLikeStatusUseCase({ commentId, userId });

        res.status(200).json({ isGood });
    } catch (err) {
        next(err);
    }
};

// GET /comment-like/:id/count
// summary: いいね数取得
// page: /item
export const commentLikeGetByIdCountController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const commentId = Number(req.params.id);

        const count = await countCommentLikeUseCase({ commentId });

        res.status(200).json({ count });
    } catch (err) {
        next(err);
    }
};

// GET /comment-like/:id/user(?keyword="")
// summary: いいねしたユーザーリスト取得
// page: /user-list/comment-like/[id]
export const commentLikeGetByIdUserController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const commentId = Number(req.params.id);
        const userId = req.user!.id;

        const query = req.validatedQuery as KeywordOptionalQuery;
        const keyword = query.keyword;

        const userList = await getCommentLikeUserListUseCase({ commentId, userId, keyword });

        res.status(200).json({ userList });
    } catch (err) {
        next(err);
    }
};
