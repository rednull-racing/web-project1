import { AppError } from "../../errors.js";
import { getMyNotification, updateReadFlag } from "../../services/notification/notification.js";

type Params = {
    notificationId: number;
    userId: number;
};

// PATCH /notification/:id/read-flag
// summary: 既読
// page: /notification
export const patchReadFlagTrueUseCase = async ({ notificationId, userId }: Params) => {
    // notification取得
    const notification = await getMyNotification({ notificationId, userId });

    if (!notification) throw new AppError("NOTIFICATION_NOT_FOUND", 404);

    // readFlag既読
    await updateReadFlag({
        notification,
        data: { read_flag: true },
    });
};
