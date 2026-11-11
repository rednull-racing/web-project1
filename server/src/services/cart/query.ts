import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import sequelize from "../../db.js";
import { Item, Cart, Video, Sale } from "../../models/index.js";
import type {
    CartItemListRow,
    GetCartItemListParams,
    CountCartItemListParams,
} from "../../types/serviceType/cart.js";

export const setCartItemListReadOnly = async ({ transaction }: { transaction: Transaction }): Promise<void> => {
    await sequelize.query("SET TRANSACTION READ ONLY", { transaction, type: QueryTypes.RAW });
};

export const getMyCartItemList = ({ userId, where, limit, offset, transaction }: GetCartItemListParams) => {
    return Cart.findAll({
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
    }) as Promise<(InstanceType<typeof Cart> & { Item: CartItemListRow })[]>;
};

export const countMyCartItemList = ({ userId, where, transaction }: CountCartItemListParams): Promise<number> => {
    return Cart.count({
        where: { user_id: userId },
        include: [{ model: Item, attributes: [], where, required: true }],
        transaction,
    });
};
