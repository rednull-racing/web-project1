import { Op } from "sequelize";
import { countUnread, getMyNotificationList } from "../../services/notification/notification.js";

type Params = {
    userId: number;
    limit: number;
    cursor?: string;
};

// GET /notification?limit=00(&cursor="")
// summary: お知らせ一覧取得
// page: /notification
export const getNotificationListUseCase = async ({ userId, limit, cursor }: Params) => {
    const where = cursor
        ? {
              read_user_id: userId,
              createdAt: {
                  [Op.lt]: new Date(cursor),
              },
          }
        : {
              read_user_id: userId,
          };

    // お知らせリスト取得
    const notificationList = await getMyNotificationList({ limit: limit + 1, where });

    const hasMore = notificationList.length > limit;

    const slicedNotificationList = hasMore ? notificationList.slice(0, limit) : notificationList;

    const lastItem = slicedNotificationList[slicedNotificationList.length - 1];

    const nextCursor = lastItem?.createdAt ?? null;

    // 未読カウント取得
    const unreadCount = await countUnread({ userId });

    return { notificationList: slicedNotificationList, unreadCount, nextCursor, hasMore };
};
