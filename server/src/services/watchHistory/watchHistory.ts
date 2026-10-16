import { Op } from "sequelize";
import { Item, Sale, Video, WatchHistory } from "../../models/index.js";
import {
    type CronDeleteWatchHistoryParams,
    DeleteWatchHistoryUserIdTransactionParams,
    ItemUserParams,
    UserWatchListParams,
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

export const getUserItemsWatchList = async ({ itemWhere, limit, offset, userId }: UserWatchListParams) => {
    const watchList = await WatchHistory.findAll({
        attributes: ["id"],
        where: { user_id: userId },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
        include: [
            {
                model: Item,
                where: itemWhere,
                attributes: [
                    "id",
                    "name",
                    "price",
                    "status",
                    "seller_id",
                    "first_image_url",
                    "gender_type",
                    "age_type",
                ],
                required: true,
                include: [
                    {
                        model: Sale,
                        attributes: ["discount_rate", "discount_amount", "sale_flag", "before_price"],
                        required: false,
                    },
                    {
                        model: Video,
                        attributes: ["title"],
                    },
                ],
            },
        ],
    });

    const itemList = watchList.map((data: InstanceType<typeof WatchHistory>) => data.Item);

    const totalCount = await WatchHistory.count({
        where: { user_id: userId },
        include: [
            {
                model: Item,
                where: itemWhere,
                required: true,
            },
        ],
    });

    return { itemList, totalCount };
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
