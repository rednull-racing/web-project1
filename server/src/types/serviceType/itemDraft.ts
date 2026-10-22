import type { Transaction } from "sequelize";
import type { ItemDraft } from "../../models/index.js";
import type { BodyCategory, Layer, LifeStyleCategory } from "../itemAttributes.js";

export type CreateItemDraftParams = {
    data: {
        seller_id: number;
        name: string;
        detail: string;
        price: number;
        first_image_url: string;
        category_id: number | null;
        gender_type: InstanceType<typeof ItemDraft>["gender_type"];
        age_type: InstanceType<typeof ItemDraft>["age_type"];
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

        before_price: number;

        shipping_day_id: number | null;
        shipping_service_id: number | null;
        shipping_place_id: number | null;
        shipping_service_free_text: string | null;
    };
    transaction?: Transaction;
};

export type UpdateItemDraftImageParams = {
    itemDraft: InstanceType<typeof ItemDraft>;
    urls: string[];
    transaction?: Transaction;
};

export type ItemDraftUserIdParams = {
    itemDraftId: number;
    userId: number;
    transaction: Transaction;
};

export type ItemDraftTransactionParams = {
    itemDraft: InstanceType<typeof ItemDraft>;
    transaction?: Transaction;
};

export type UpdateItemDraftVideoData =
    | { video_status: "processing" }
    | { video_status: "converted"; converted_url: string; duration: number }
    | { video_status: "failed"; converted_url: null };

export type UpdateItemDraftVideoParams = {
    itemDraft: InstanceType<typeof ItemDraft>;
    data: UpdateItemDraftVideoData;
    transaction: Transaction;
};
