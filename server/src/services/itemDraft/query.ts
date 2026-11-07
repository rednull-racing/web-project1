import { Op, QueryTypes } from "sequelize";
import sequelize from "../../db.js";
import type { Transaction } from "sequelize";
import type {
    GetItemDraftListParams,
    CountItemDraftListParams,
    ItemDraftListRow,
} from "../../types/serviceType/itemDraft.js";
import {
    Brands,
    Categories,
    ItemConditionOption,
    ItemDraft,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
} from "../../models/index.js";
import type { ItemDraftUserIdParams } from "../../types/serviceType/itemDraft.js";

type PageParams = Pick<ItemDraftUserIdParams, "itemDraftId" | "userId">;

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

export const getMyItemDraftPage = ({ itemDraftId, userId }: PageParams) => {
    return ItemDraft.findOne({
        attributes: [
            "id",
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
            "video_status",
            "shipping_service_free_text",
            "updatedAt",
        ],
        where: { id: itemDraftId, seller_id: userId },
        include: [
            {
                model: Categories,
                as: "Category",
                attributes: ["id", "name"],
                required: false,
                include: [
                    {
                        model: Categories,
                        as: "children",
                        attributes: ["id", "name"],
                        required: false,
                    },
                    {
                        model: Categories,
                        as: "parent",
                        attributes: ["id", "name"],
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

export const getMyItemDraftPageMetadata = ({ itemDraftId, userId }: PageParams) => {
    return ItemDraft.findOne({
        attributes: ["id", "name"],
        where: { id: itemDraftId, seller_id: userId },
    });
};

export const setItemDraftListReadOnly = async ({ transaction }: { transaction: Transaction }): Promise<void> => {
    await sequelize.query("SET TRANSACTION READ ONLY", { transaction, type: QueryTypes.RAW });
};

export const getMyItemDraftList = ({
    userId,
    where,
    limit,
    offset,
    transaction,
}: GetItemDraftListParams): Promise<ItemDraftListRow[]> => {
    return ItemDraft.findAll({
        attributes: ["id", "name", "price", "first_image_url", "title", "createdAt"],
        where: { [Op.and]: [{ seller_id: userId }, where] },
        limit,
        offset,
        order: [
            ["createdAt", "DESC"],
            ["id", "DESC"],
        ],
        transaction,
    });
};

export const countMyItemDraftList = ({ userId, where, transaction }: CountItemDraftListParams): Promise<number> => {
    return ItemDraft.count({ where: { [Op.and]: [{ seller_id: userId }, where] }, transaction });
};
