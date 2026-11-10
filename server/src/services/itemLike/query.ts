import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import sequelize from "../../db.js";
import { Item, ItemLike, Video, Sale } from "../../models/index.js";
import type {
    ItemLikeListRow,
    GetItemLikeListParams,
    CountItemLikeListParams,
} from "../../types/serviceType/itemLike.js";

export const setItemLikeListReadOnly = async ({ transaction }: { transaction: Transaction }): Promise<void> => {
    await sequelize.query("SET TRANSACTION READ ONLY", { transaction, type: QueryTypes.RAW });
};

export const getMyItemLikeList = ({ userId, where, limit, offset, transaction }: GetItemLikeListParams) => {
    return ItemLike.findAll({
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
    }) as Promise<(InstanceType<typeof ItemLike> & { Item: ItemLikeListRow })[]>;
};

export const countMyItemLikeList = ({ userId, where, transaction }: CountItemLikeListParams): Promise<number> => {
    return ItemLike.count({
        where: { user_id: userId },
        include: [{ model: Item, attributes: [], where, required: true }],
        transaction,
    });
};
