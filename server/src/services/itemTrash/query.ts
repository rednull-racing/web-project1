import { Item, Video, Sale, ItemShippingProfile } from "../../models/index.js";
import type { GetMyItemForTrashParams, ItemForTrash } from "../../types/serviceType/itemTrash.js";

export const getMyItemForTrash = async ({
    itemId,
    userId,
    transaction,
}: GetMyItemForTrashParams): Promise<ItemForTrash | null> => {
    const options = { transaction, lock: transaction.LOCK.UPDATE };
    const item = await Item.findOne({
        attributes: [
            "id", "status", "video_id", "sale_id", "shipping_id", "name", "detail", "image_url",
            "first_image_url", "item_condition_id", "seller_id", "gender_type", "age_type",
            "recommend", "category_id", "brand_id", "brand_aliases_id", "attributes",
        ],
        where: { id: itemId, seller_id: userId },
        ...options,
    });
    if (!item) return null;
    const video = item.video_id === null ? null : await Video.findByPk(item.video_id, {
        attributes: ["id", "title", "summary", "thumbnail_url", "duration", "original_url", "converted_url", "status"], ...options,
    });
    const sale = item.sale_id === null ? null : await Sale.findByPk(item.sale_id, {
        attributes: ["id", "before_price"], ...options,
    });
    const shipping = item.shipping_id === null ? null : await ItemShippingProfile.findByPk(item.shipping_id, {
        attributes: ["id", "shipping_day_id", "shipping_service_id", "shipping_place_id", "shipping_service_free_text"], ...options,
    });
    return { item, video, sale, shipping };
};
