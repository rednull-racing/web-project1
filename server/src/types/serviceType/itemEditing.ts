import { Transaction } from "sequelize";
import { ItemEditing } from "../../models/index.js";
import { BodyCategory, Layer, LifeStyleCategory } from "../itemAttributes.js";

export type ItemEditingUserIdParams = {
    itemEditingId: number;
    userId: number;
};

export type CreateItemEditingParams = {
    data: {
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
