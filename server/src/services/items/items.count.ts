import { Op } from "sequelize";
import { Item } from "../../models/index.js";
import type { UserIdParams } from "../../types/serviceType/items.js";

export const countSellItem = ({ userId, transaction }: UserIdParams) => {
    return Item.count({
        where: {
            seller_id: userId,
            status: { [Op.in]: ["active", "soldout"] },
        },
        ...(transaction ? { transaction } : {}),
    });
};

export const countSoldItem = ({ userId }: UserIdParams) => {
    return Item.count({
        where: {
            seller_id: userId,
            status: "soldout",
        },
    });
};
