import { ItemDraft } from "../../models/index.js";
import type { ItemDraftUserIdParams } from "../../types/serviceType/itemDraft.js";

export const getMyItemDraft = ({ itemDraftId, userId, transaction }: ItemDraftUserIdParams) => {
    return ItemDraft.findOne({
        attributes: [
            "id",
            "name",
            "detail",
            "image_url",
            "price",
            "item_condition_id",
            "first_image_url",
            "gender_type",
            "age_type",
            "recommend",
            "category_id",
            "brand_id",
            "brand_aliases_id",
            "attributes",
            "thumbnail_url",
            "title",
            "summary",
            "duration",
            "original_url",
            "converted_url",
            "video_status",
            "before_price",
            "discount_rate",
            "discount_amount",
            "sale_flag",
            "shipping_day_id",
            "shipping_service_id",
            "shipping_place_id",
            "shipping_service_free_text",
        ],
        where: { id: itemDraftId, seller_id: userId },
        transaction,
        lock: transaction.LOCK.UPDATE,
    });
};
