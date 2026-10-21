import type { NextFunction, Request, Response } from "express-serve-static-core";
import { addFollowUseCase } from "../../usecases/follow/add.js";
import { countFollowUseCase } from "../../usecases/follow/count.js";
import { deleteFollowUseCase } from "../../usecases/follow/delete.js";
import { getFollowStatusUseCase } from "../../usecases/follow/status.js";
import { getFollowUserListUseCase } from "../../usecases/follow/userList.js";
import { FollowUserListQuery } from "../../validators/query/follow.js";

// POST /follow/:id
// summary: フォロー作成
// page: フォローボタンがあるページ
export const followPostByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const currentUserId = req.user!.id;
        const targetUserId = Number(req.params.id);

        await addFollowUseCase({ currentUserId, targetUserId });

        res.status(200).json({ message: "フォローしました" });
    } catch (err) {
        next(err);
    }
};

// DELETE /follow/:id
// summary: フォロー削除
// page: フォローボタンがあるページ
export const followDeleteByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const currentUserId = req.user!.id;
        const targetUserId = Number(req.params.id);

        await deleteFollowUseCase({ currentUserId, targetUserId });

        res.status(200).json({ message: "フォロー解除しました" });
    } catch (err) {
        next(err);
    }
};

// GET /follow/:id/status
// summary: フォローステータス取得
// page: フォローボタンがあるページ
export const followGetByIdStatusController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const currentUserId = req.user!.id;
        const targetUserId = Number(req.params.id);

        if (currentUserId === targetUserId) {
            res.status(200).json({ isFollowing: false });
            return;
        }

        const isFollowing = await getFollowStatusUseCase({ currentUserId, targetUserId });

        res.status(200).json({ isFollowing });
    } catch (err) {
        next(err);
    }
};

// GET /follow/:id/count
// summary: フォロー・フォロワー数カウント取得
// page: フォロー・フォロワー数表示
export const followGetByIdCountController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = Number(req.params.id);

        const { followCount, followerCount } = await countFollowUseCase({ userId });

        res.status(200).json({ followCount, followerCount });
    } catch (err) {
        next(err);
    }
};

// GET /follow/:id/user?type=""(&keyword="")
// summary: フォロー・フォロワーリスト取得
// page: /user-list/follow/[id]
export const followGetByIdUserController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const currentUserId = req.user?.id ?? null;
        const pageUserId = Number(req.params.id);

        const query = req.validatedQuery as FollowUserListQuery;
        const { type, keyword } = query;

        const userList = await getFollowUserListUseCase({ currentUserId, pageUserId, type, keyword });

        res.status(200).json({ userList });
    } catch (err) {
        next(err);
    }
};
