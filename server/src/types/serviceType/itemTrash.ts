import type { Transaction, WhereOptions } from "sequelize";
import type Item from "../../models/item.js";
import type ItemTrash from "../../models/item_trash.js";
import type Video from "../../models/video.js";
import type Sale from "../../models/sale.js";
import type ItemShippingProfile from "../../models/item_shipping_profile.js";

export type GetMyItemForTrashParams = { itemId: number; userId: number; transaction: Transaction };
export type ItemForTrash = {
    item: InstanceType<typeof Item>;
    video: InstanceType<typeof Video> | null;
    sale: InstanceType<typeof Sale> | null;
    shipping: InstanceType<typeof ItemShippingProfile> | null;
};
export type CreateItemTrashParams = {
    data: Pick<
        InstanceType<typeof ItemTrash>,
        | "item_id"
        | "name"
        | "detail"
        | "image_url"
        | "first_image_url"
        | "item_condition_id"
        | "seller_id"
        | "gender_type"
        | "age_type"
        | "recommend"
        | "category_id"
        | "brand_id"
        | "brand_aliases_id"
        | "attributes"
        | "price"
        | "title"
        | "summary"
        | "thumbnail_url"
        | "duration"
        | "original_url"
        | "converted_url"
        | "video_status"
        | "shipping_day_id"
        | "shipping_service_id"
        | "shipping_place_id"
        | "shipping_service_free_text"
    >;
    transaction: Transaction;
};

export type ItemTrashListRow = Pick<ItemTrash, "id" | "name" | "price" | "first_image_url" | "title" | "createdAt">;
export type CountItemTrashListParams = {
    userId: number;
    where: WhereOptions<ItemTrash>;
    transaction: Transaction;
};
export type GetItemTrashListParams = CountItemTrashListParams & { limit: number; offset: number };
