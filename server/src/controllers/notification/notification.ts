import type { NextFunction, Request, Response } from "express-serve-static-core";
import { countUnreadNotificationsUseCase } from "../../usecases/notification/countUnread.js";
import { getNotificationListUseCase } from "../../usecases/notification/getList.js";
import { patchReadFlagTrueUseCase } from "../../usecases/notification/readFlagTrue.js";
import { GetNotificationListQuery } from "../../validators/query/notification.js";

// PATCH /notification/:id/read-flag
// summary: 既読
// page: /notification
export const notificationPatchByIdReadFlagController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const notificationId = Number(req.params.id);
        const userId = req.user!.id;

        await patchReadFlagTrueUseCase({ notificationId, userId });

        res.status(200).json({ isRead: true });
    } catch (err) {
        next(err);
    }
};

// GET /notification/unread-count
// summary: 未読通知カウント
// page: footer, /my-page
export const notificationGetUnreadCountController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;

        const unreadCount = await countUnreadNotificationsUseCase({ userId });

        res.status(200).json({ unreadCount });
    } catch (err) {
        next(err);
    }
};

// GET /notification?limit=00(&cursor="")
// summary: お知らせ一覧取得
// page: /notification
export const notificationGetRootController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const query = req.validatedQuery as GetNotificationListQuery;
        const { limit, cursor } = query;

        const { notificationList, unreadCount, nextCursor, hasMore } = await getNotificationListUseCase({
            userId,
            limit,
            cursor,
        });

        res.status(200).json({ notificationList, unreadCount, nextCursor, hasMore });
    } catch (err) {
        next(err);
    }
};
