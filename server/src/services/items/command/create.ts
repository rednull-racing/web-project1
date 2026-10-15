import { Item } from "../../../models/index.js";
import type { CreateItemParams } from "../../../types/serviceType/items.js";

export const createItem = async ({ userId, saleId, transaction }: CreateItemParams) => {
    const item = await Item.create(
        {
            seller_id: userId,
            sale_id: saleId,
        },
        { transaction },
    );

    return item.id;
};
