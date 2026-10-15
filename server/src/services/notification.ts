import dayjs from "dayjs";
import { Op } from "sequelize";
import { NOTIFICATION_CONFIG, NOTIFICATION_RETENTION_DAYS } from "../config/notification.js";
import { Notification } from "../models/index.js";
import {
    CreateNotificationParams,
    type CronDeleteNotificationParams,
    DeleteNotificationUserIdTransactionParams,
    NotificationIdParams,
    NotificationListParams,
    NotificationUserIdParams,
    UpdateReadFlagParams,
    UpdateTypeParams,
    UserIdParams,
} from "../types/serviceType/notification.js";

export const getMyNotificationList = ({ limit, where }: NotificationListParams) => {
    return Notification.findAll({
        attributes: ["id", "message", "message_image", "read_flag", "createdAt", "url"],
        where,
        order: [["createdAt", "DESC"]],
        limit,
    });
};

export const getMyNotificationAll = () => {
    return Notification.findAll();
};

export const getNotification = ({ notificationId }: NotificationIdParams) => {
    return Notification.findByPk(notificationId);
};

export const getMyNotification = ({ notificationId, userId }: NotificationUserIdParams) => {
    return Notification.findOne({
        where: {
            id: notificationId,
            read_user_id: userId,
        },
    });
};

export const createNotification = async ({ data, transaction }: CreateNotificationParams) => {
    const retentionLevel = NOTIFICATION_CONFIG[data.type].retention;

    const retentionDays = NOTIFICATION_RETENTION_DAYS[retentionLevel];

    const expires_at = retentionDays === null ? null : dayjs().add(retentionDays, "day").toDate();

    await Notification.create(
        {
            ...data,
            expires_at,
        },
        { transaction },
    );
};

export const updateNotificationType = async ({ notification, data, transaction }: UpdateTypeParams) => {
    const retentionLevel = NOTIFICATION_CONFIG[data.type].retention;

    const retentionDays = NOTIFICATION_RETENTION_DAYS[retentionLevel];

    const expires_at = retentionDays === null ? null : dayjs(notification.createdAt).add(retentionDays, "day").toDate();

    await notification.update(
        {
            ...data,
            expires_at,
        },
        { transaction },
    );
};

export const updateReadFlag = async ({ notification, data, transaction }: UpdateReadFlagParams) => {
    await notification.update(data, { transaction });
};

export const countUnread = ({ userId }: UserIdParams) => {
    return Notification.count({
        where: {
            read_user_id: userId,
            read_flag: false,
        },
    });
};

export const deleteNotificationUserLogical = async ({
    userId,
    transaction,
}: DeleteNotificationUserIdTransactionParams) => {
    await Notification.destroy({
        where: { read_user_id: userId },
        transaction,
    });
};

export const deleteCronNotification = ({ expiredBefore }: CronDeleteNotificationParams) => {
    return Notification.destroy({
        where: {
            expires_at: { [Op.lt]: expiredBefore },
        },
    });
};
