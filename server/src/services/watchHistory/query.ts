import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import sequelize from "../../db.js";
import { Item, WatchHistory, Video, Sale } from "../../models/index.js";
import type {
    WatchItemListRow,
    GetWatchItemListParams,
    CountWatchItemListParams,
} from "../../types/serviceType/watchHistory.js";

export const setWatchItemListReadOnly = async ({ transaction }: { transaction: Transaction }): Promise<void> => {
    await sequelize.query("SET TRANSACTION READ ONLY", { transaction, type: QueryTypes.RAW });
};

export const getMyWatchItemList = ({ userId, where, limit, offset, transaction }: GetWatchItemListParams) => {
    return WatchHistory.findAll({
        attributes: ["id", "item_id"],
        where: { user_id: userId },
        limit,
        offset,
        order: [
            ["createdAt", "DESC"],
            ["id", "DESC"],
        ],
        include: [
            {
                model: Item,
                attributes: ["id", "name", "price", "status", "first_image_url", "gender_type", "age_type"],
                where,
                required: true,
                include: [
                    { model: Video, attributes: ["title"], required: false },
                    {
                        model: Sale,
                        attributes: ["before_price", "sale_flag", "discount_rate", "discount_amount"],
                        required: false,
                    },
                ],
            },
        ],
        transaction,
    }) as Promise<(InstanceType<typeof WatchHistory> & { Item: WatchItemListRow })[]>;
};

export const countMyWatchItemList = ({ userId, where, transaction }: CountWatchItemListParams): Promise<number> => {
    return WatchHistory.count({
        where: { user_id: userId },
        include: [{ model: Item, attributes: [], where, required: true }],
        transaction,
    });
};
