import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import type ItemEditing from "../../../models/item_editing.js";
import { getCategories } from "../../../services/categories/categories.js";
import { deleteItemEditing } from "../../../services/itemEditing/command.js";
import { getMyItemEditing } from "../../../services/itemEditing/query.js";
import { getMyItemForUpdate } from "../../../services/items/query/relation.js";
import { updateItem } from "../../../services/items/command/update.js";
import { updateShipping } from "../../../services/itemShippingProfile/itemShippingProfile.js";
import { createNotification } from "../../../services/notification/notification.js";
import { updateSale } from "../../../services/sale/sale.js";
import { getUser } from "../../../services/users/query.js";
import { updateVideo } from "../../../services/video/video.js";
import type { ItemAttributes } from "../../../types/itemAttributes.js";
import { normalizeJapanese } from "../../../utils/normalizeJapanese.js";
import { validateMaster } from "../../shared/validateMaster.js";

type Params = {
    userId: number;
    itemEditingId: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isInventory = (value: unknown): boolean =>
    isRecord(value) &&
    [value.initial, value.current, value.low_stock_ratio].every(
        (number) => typeof number === "number" && Number.isFinite(number),
    );

const hasCopyableInventory = (value: unknown): boolean => {
    if (!isRecord(value) || !isInventory(value.inventory)) return false;
    if (value.colorVariants === undefined) return true;
    if (!Array.isArray(value.colorVariants)) return false;
    return value.colorVariants.every((color: unknown) => {
        if (!isRecord(color) || (color.inventory !== undefined && !isInventory(color.inventory))) return false;
        if (color.sizes === undefined) return true;
        return (
            Array.isArray(color.sizes) &&
            color.sizes.every((size: unknown) => isRecord(size) && isInventory(size.inventory))
        );
    });
};

const resetCurrentInventory = (inventory: NonNullable<ItemAttributes["inventory"]>): void => {
    if (!Number.isInteger(inventory.initial) || inventory.initial < 0) {
        throw new AppError("ITEM_PUBLISH_DATA_INVALID", 400, "在庫数を確認して、もう一度保存してください。");
    }
    inventory.current = inventory.initial;
};

const resetInventory = (
    source: ItemAttributes,
): ItemAttributes & { inventory: NonNullable<ItemAttributes["inventory"]> } => {
    // 保存済みJSONBはModelのTypeScript型だけでは構造を保証できない。
    if (!hasCopyableInventory(source)) {
        throw new AppError(
            "ITEM_ATTRIBUTES_INVALID",
            500,
            "商品の在庫情報を確認できません。時間をおいてもう一度お試しください。",
        );
    }
    const attributes = structuredClone(source);
    if (attributes.inventory) {
        resetCurrentInventory(attributes.inventory);
    }
    for (const color of attributes.colorVariants ?? []) {
        if (color.inventory) {
            resetCurrentInventory(color.inventory);
        }
        for (const size of color.sizes ?? []) {
            resetCurrentInventory(size.inventory);
        }
    }
    if (!attributes.inventory) throw new AppError("ITEM_ATTRIBUTES_INVALID", 500);
    return { ...attributes, inventory: attributes.inventory };
};

const validatePublishData = (itemEditing: InstanceType<typeof ItemEditing>): void => {
    if (!itemEditing.original_url) throw new AppError("VIDEO_URL_NULL", 400);
    if (!itemEditing.thumbnail_url) throw new AppError("THUMBNAIL_URL_NULL", 400);
    if (!itemEditing.image_url || itemEditing.image_url.length === 0) {
        throw new AppError("ITEM_IMAGE_NULL", 400);
    }
    if (itemEditing.image_url.length > 10) {
        throw new AppError("ITEM_IMAGE_LIMIT_EXCEEDED", 400, "商品画像は10枚以内にしてください。");
    }
    const requiredIds = [
        itemEditing.category_id,
        itemEditing.item_condition_id,
        itemEditing.shipping_day_id,
        itemEditing.shipping_service_id,
        itemEditing.shipping_place_id,
    ];
    if (requiredIds.some((id) => id === null || !Number.isInteger(id) || id < 1 || id > 2147483647)) {
        throw new AppError("INVALID_NUMBER", 400);
    }
    const nullableBrandIds = [itemEditing.brand_id, itemEditing.brand_aliases_id];
    if (nullableBrandIds.some((id) => id !== null && (!Number.isInteger(id) || id < 1 || id > 2147483647))) {
        throw new AppError("INVALID_NUMBER", 400);
    }
    if (
        typeof itemEditing.name !== "string" ||
        itemEditing.name.length === 0 ||
        typeof itemEditing.title !== "string" ||
        itemEditing.title.length === 0 ||
        !itemEditing.first_image_url ||
        itemEditing.price === null ||
        !Number.isInteger(itemEditing.price) ||
        itemEditing.price < 300 ||
        itemEditing.price > 1000000
    ) {
        throw new AppError("ITEM_PUBLISH_DATA_INVALID", 400, "商品情報を確認して、もう一度保存してください。");
    }
};

// PUT /items
// summary: 商品情報編集
// page: /item/confirm/edit/[id]
export const updateItemUseCase = async ({ userId, itemEditingId }: Params): Promise<number> => {
    const { itemId, name, firstImageUrl } = await sequelize.transaction(async (transaction) => {
        const itemEditing = await getMyItemEditing({ itemEditingId, userId, transaction });
        if (!itemEditing) throw new AppError("ITEM_EDITING_NOT_FOUND", 404);
        if (
            itemEditing.status !== "edit" ||
            itemEditing.item_id === null ||
            !Number.isInteger(itemEditing.item_id) ||
            itemEditing.item_id < 1 ||
            itemEditing.item_id > 2147483647
        ) {
            throw new AppError("ITEM_EDITING_STATE_INVALID", 400, "編集する商品を選び直してください。");
        }
        const target = await getMyItemForUpdate({ itemId: itemEditing.item_id, userId, transaction });
        if (!target) throw new AppError("ITEM_NOT_FOUND", 404);
        const { item, video, sale, shipping } = target;
        if (!video || !sale || !shipping) throw new AppError("ITEM_RELATION_NOT_FOUND", 500);
        validatePublishData(itemEditing);
        const attributes = resetInventory(itemEditing.attributes);
        const user = await getUser({ userId, attributes: ["id", "user_name"], transaction });
        if (!user) throw new AppError("USER_NOT_FOUND", 500);
        const category = await validateMaster({
            categoryId: itemEditing.category_id,
            conditionId: itemEditing.item_condition_id,
            dayId: itemEditing.shipping_day_id,
            serviceId: itemEditing.shipping_service_id,
            placeId: itemEditing.shipping_place_id,
            transaction,
        });
        const parentCategory =
            category?.parent_id != null ? await getCategories({ categoryId: category.parent_id, transaction }) : null;
        const searchText = `
    ${itemEditing.name}
    ${itemEditing.title ?? ""}
    ${category?.name ?? ""}
    ${parentCategory?.name ?? ""}
    ${user.user_name ?? ""}
    `;
        await updateVideo({
            video,
            data: {
                thumbnail_url: itemEditing.thumbnail_url,
                title: itemEditing.title,
                summary: itemEditing.summary,
                duration: itemEditing.duration,
                original_url: itemEditing.original_url,
                converted_url: itemEditing.converted_url,
                status: itemEditing.video_status,
            },
            transaction,
        });
        await updateSale({
            sale,
            data: {
                before_price: itemEditing.before_price,
                discount_rate: null,
                discount_amount: null,
                sale_flag: false,
            },
            transaction,
        });
        await updateShipping({
            shipping,
            data: {
                shipping_day_id: itemEditing.shipping_day_id,
                shipping_service_id: itemEditing.shipping_service_id,
                shipping_place_id: itemEditing.shipping_place_id,
                shipping_service_free_text: itemEditing.shipping_service_free_text,
            },
            transaction,
        });
        await updateItem({
            item,
            data: {
                name: itemEditing.name,
                detail: itemEditing.detail,
                image_url: itemEditing.image_url,
                price: itemEditing.price,
                item_condition_id: itemEditing.item_condition_id,
                first_image_url: itemEditing.first_image_url,
                gender_type: itemEditing.gender_type,
                age_type: itemEditing.age_type,
                recommend: itemEditing.recommend,
                category_id: itemEditing.category_id,
                brand_id: itemEditing.brand_id,
                brand_aliases_id: itemEditing.brand_aliases_id,
                attributes,
                search_text: normalizeJapanese(searchText),
                status: attributes.inventory.current >= 1 ? "active" : "soldout",
                save_at: new Date(),
            },
            transaction,
        });
        await deleteItemEditing({ itemEditing, transaction });
        return { itemId: item.id, name: itemEditing.name, firstImageUrl: itemEditing.first_image_url };
    });
    // 通知は更新の成立条件に含めず、commit成功後にだけ開始する。
    createNotification({
        data: {
            read_user_id: userId,
            url: `/item/${itemId}`,
            message_image: firstImageUrl,
            message: `商品「${name}」が更新されました。商品の詳細はこちらの商品ページからご確認ください。`,
            type: "ITEM",
        },
    }).catch((error: unknown) => {
        console.error("service createNotification error", error);
    });
    return itemId;
};
