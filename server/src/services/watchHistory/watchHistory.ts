import { Op } from "sequelize";
import { WatchHistory } from "../../models/index.js";
import {
    type CronDeleteWatchHistoryParams,
    DeleteWatchHistoryUserIdTransactionParams,
    ItemUserParams,
    WatchHistoryParams,
} from "../../types/serviceType/watchHistory.js";

export const getWatchHistoryOne = async ({ itemId, userId }: ItemUserParams) => {
    return WatchHistory.findOne({
        where: {
            item_id: itemId,
            user_id: userId,
        },
    });
};

export const createWatchHistory = async ({ itemId, userId }: ItemUserParams) => {
    return WatchHistory.create({
        item_id: itemId,
        user_id: userId,
    });
};

export const updateUpdateAt = async ({ history }: WatchHistoryParams) => {
    const nowDate = new Date();

    history.updatedAt = nowDate;
    await history.save();
};

export const destroyWatchHistory = async ({ history }: WatchHistoryParams) => {
    await history.destroy();
};

export const deleteWatchHistoryUserLogical = async ({
    userId,
    transaction,
}: DeleteWatchHistoryUserIdTransactionParams) => {
    await WatchHistory.destroy({
        where: { user_id: userId },
        transaction,
    });
};

export const deleteCronWatchHistory = ({ updatedBefore }: CronDeleteWatchHistoryParams) => {
    return WatchHistory.destroy({
        where: {
            updatedAt: { [Op.lt]: updatedBefore },
        },
    });
};
