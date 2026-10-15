import { Item } from "../../../models/index.js";
import type { CreateItemParams } from "../../../types/serviceType/items.js";

export const createItem = async ({ userId, saleId, videoId, transaction }: CreateItemParams) => {
    const item = await Item.create(
        {
            seller_id: userId,
            sale_id: saleId,
            video_id: videoId,
        },
        { transaction },
    );

    return item.id;
};
