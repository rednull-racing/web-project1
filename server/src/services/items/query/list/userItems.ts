import { Item, Sale, Video } from "../../../../models/index.js";
import { ItemListParams } from "../../../../types/serviceType/items.js";

export const getUserItemsStatusList = async ({ where, limit, offset }: ItemListParams) => {
    const itemList = await Item.findAll({
        attributes: ["id", "name", "price", "status", "seller_id", "save_at", "first_image_url"],
        where,
        limit,
        offset,
        order: [["save_at", "DESC"]],
        include: [
            {
                model: Video,
                attributes: ["title"],
            },
        ],
    });

    const totalCount = await Item.count({ where });

    return { itemList, totalCount };
};

export const getUserItemsStockList = async ({ where, limit, offset }: ItemListParams) => {
    const itemList = await Item.findAll({
        attributes: ["id", "name", "price", "status", "seller_id", "save_at", "first_image_url", "attributes"],
        where,
        limit,
        offset,
        order: [["uploaded_at", "DESC"]],
        include: [
            {
                model: Video,
                attributes: ["title"],
            },
            {
                model: Sale,
                attributes: ["discount_rate", "discount_amount", "sale_flag", "before_price"],
            },
        ],
    });

    const totalCount = await Item.count({ where });

    return { itemList, totalCount };
};
