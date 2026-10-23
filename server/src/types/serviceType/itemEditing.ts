import type { Transaction } from "sequelize";
import type ItemEditing from "../../models/item_editing.js";
import { BodyCategory, Layer, LifeStyleCategory } from "../itemAttributes.js";

export type ItemEditingUserIdParams = {
    itemEditingId: number;
    userId: number;
};

export type ItemEditingTransactionParams = {
    itemEditing: InstanceType<typeof ItemEditing>;
    transaction: Transaction;
};

export type CreateItemEditingParams = {
    data: {
        status: "normal";
        seller_id: number;
    };
    transaction?: Transaction;
};

export type UpdateConfirmParams = {
    itemEditing: InstanceType<typeof ItemEditing>;
    data: {
        name: string;
        detail: string;
        price: number;
        first_image_url: string;
        category_id: number | null;
        gender_type: string | null;
        age_type: string | null;
        brand_id: number | null;
        brand_aliases_id: number | null;
        item_condition_id: number | null;
        attributes: {
            inventory?: {
                initial: number;
                current: number;
                low_stock_ratio: number;
            };

            colorVariants?: Array<{
                uiId?: string;
                color?: string;
                image_url?: string;
                inventory?: {
                    initial: number;
                    current: number;
                    low_stock_ratio: number;
                };

                sizes?: Array<{
                    size: string;
                    inventory: {
                        initial: number;
                        current: number;
                        low_stock_ratio: number;
                    };
                }>;
            }>;

            materials?: Array<{
                name: string;
                ratio: number;
            }>;

            body_category?: BodyCategory;
            lifestyle_category?: LifeStyleCategory;
            layer?: Layer;
        };

        title: string;
        summary: string;
        thumbnail_url: string;
        original_url: string | null;
        video_status: "original";

        before_price: number;

        shipping_day_id: number | null;
        shipping_service_id: number | null;
        shipping_place_id: number | null;
        shipping_service_free_text: string | null;
    };
    transaction?: Transaction;
};

export type UpdateItemEditingImageParams = {
    itemEditing: InstanceType<typeof ItemEditing>;
    urls: string[];
    transaction?: Transaction;
};

export type UpdateItemEditingVideoData =
    | { video_status: "processing" }
    | { video_status: "converted"; converted_url: string; duration: number }
    | { video_status: "failed"; converted_url: null };

export type UpdateItemEditingVideoParams = ItemEditingTransactionParams & {
    data: UpdateItemEditingVideoData;
};

export type CreateItemEditingDraftParams = {
    data: Pick<
        InstanceType<typeof ItemEditing>,
        | "name"
        | "detail"
        | "image_url"
        | "price"
        | "item_condition_id"
        | "first_image_url"
        | "gender_type"
        | "age_type"
        | "recommend"
        | "category_id"
        | "brand_id"
        | "brand_aliases_id"
        | "attributes"
        | "thumbnail_url"
        | "title"
        | "summary"
        | "duration"
        | "original_url"
        | "converted_url"
        | "video_status"
        | "before_price"
        | "discount_rate"
        | "discount_amount"
        | "sale_flag"
        | "shipping_day_id"
        | "shipping_service_id"
        | "shipping_place_id"
        | "shipping_service_free_text"
    > & { seller_id: number; status: "normal" };
    transaction: Transaction;
};

export type CreateItemEditingCopyParams = {
    data: CreateItemEditingDraftParams["data"] & {
        discount_rate: null;
        discount_amount: null;
        sale_flag: false;
    };
    transaction: Transaction;
};
