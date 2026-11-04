import type { Transaction } from "sequelize";
import {
    Brands,
    Categories,
    ItemConditionOption,
    ItemEditing,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
} from "../../models/index.js";
import type { ItemEditingUserIdParams } from "../../types/serviceType/itemEditing.js";

type GetMyItemEditingParams = ItemEditingUserIdParams & {
    transaction?: Transaction;
};

export const getMyItemEditing = ({ itemEditingId, userId, transaction }: GetMyItemEditingParams) => {
    return ItemEditing.findOne({
        where: {
            id: itemEditingId,
            seller_id: userId,
        },
        ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    });
};

type GetMyItemConfirmPageParams = Pick<ItemEditingUserIdParams, "itemEditingId" | "userId">;

export const getMyItemConfirmPage = ({ itemEditingId, userId }: GetMyItemConfirmPageParams) => {
    return ItemEditing.findOne({
        where: { id: itemEditingId, seller_id: userId },
        attributes: [
            "id",
            "status",
            "item_id",
            "seller_id",
            "name",
            "detail",
            "price",
            "image_url",
            "first_image_url",
            "gender_type",
            "age_type",
            "recommend",
            "attributes",
            "thumbnail_url",
            "title",
            "summary",
            "duration",
            "original_url",
            "converted_url",
            "before_price",
            "discount_rate",
            "discount_amount",
            "sale_flag",
            "shipping_service_free_text",
            "updatedAt",
        ],
        include: [
            {
                model: Categories,
                as: "Category",
                attributes: ["id", "name"],
                required: false,
                include: [
                    { model: Categories, as: "children", attributes: ["id", "name"], required: false },
                    { model: Categories, as: "parent", attributes: ["id", "name"], required: false },
                ],
            },
            { model: Brands, as: "Brand", attributes: ["id", "name"], required: false },
            { model: ItemConditionOption, attributes: ["id", "name"], required: false },
            { model: ShippingDayOption, attributes: ["id", "name"], required: false },
            { model: ShippingServiceOption, attributes: ["id", "name"], required: false },
            { model: TodouhukenOption, attributes: ["id", "name"], required: false },
        ],
    });
};

type GetMyItemConfirmPageMetadataParams = Pick<ItemEditingUserIdParams, "itemEditingId" | "userId">;

export const getMyItemConfirmPageMetadata = ({ itemEditingId, userId }: GetMyItemConfirmPageMetadataParams) => {
    return ItemEditing.findOne({
        where: { id: itemEditingId, seller_id: userId },
        attributes: ["id", "name"],
    });
};

type GetMyItemEditingFormParams = Pick<ItemEditingUserIdParams, "itemEditingId" | "userId">;

export const getMyItemEditingForm = ({ itemEditingId, userId }: GetMyItemEditingFormParams) => {
    return ItemEditing.findOne({
        where: { id: itemEditingId, seller_id: userId },
        attributes: [
            "id",
            "status",
            "seller_id",
            "name",
            "detail",
            "price",
            "image_url",
            "first_image_url",
            "gender_type",
            "age_type",
            "attributes",
            "thumbnail_url",
            "title",
            "summary",
            "duration",
            "original_url",
            "converted_url",
            "video_status",
            "before_price",
            "shipping_service_free_text",
        ],
        include: [
            {
                model: Categories,
                as: "Category",
                attributes: ["id", "name", "level", "allowed_gender", "allowed_age", "parent_id"],
                required: false,
                include: [
                    {
                        model: Categories,
                        as: "children",
                        attributes: ["id", "name", "level", "allowed_gender", "allowed_age", "parent_id"],
                        required: false,
                    },
                    {
                        model: Categories,
                        as: "parent",
                        attributes: ["id", "name", "level", "allowed_gender", "allowed_age", "parent_id"],
                        required: false,
                    },
                ],
            },
            { model: Brands, as: "Brand", attributes: ["id", "name"], required: false },
            { model: ItemConditionOption, attributes: ["id", "name"], required: false },
            { model: ShippingDayOption, attributes: ["id", "name"], required: false },
            { model: ShippingServiceOption, attributes: ["id", "name"], required: false },
            { model: TodouhukenOption, attributes: ["id", "name"], required: false },
        ],
    });
};
