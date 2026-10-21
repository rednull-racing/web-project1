import { countUnread } from "../../services/notification/notification.js";

type Params = {
    userId: number;
};

// GET /notification/unread-count
// summary: 未読通知カウント
// page: footer, /my-page
export const countUnreadNotificationsUseCase = async ({ userId }: Params): Promise<number> => {
    const count = await countUnread({ userId });

    return count;
};
