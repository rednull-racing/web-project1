import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { createItemEditingCopy } from "../../../services/itemEditing/command.js";
import { getMyItemWithVideoSaleShipping } from "../../../services/items/index.js";
import type { ItemAttributes } from "../../../types/itemAttributes.js";

type Params = {
    userId: number;
    itemId: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const isInventory = (value: unknown): boolean =>
    isRecord(value) && [value.initial, value.current, value.low_stock_ratio].every(
        (number) => typeof number === "number" && Number.isFinite(number),
    );

const hasCopyableInventory = (value: unknown): boolean => {
    if (!isRecord(value) || (value.inventory !== undefined && !isInventory(value.inventory))) return false;
    if (value.colorVariants === undefined) return true;
    if (!Array.isArray(value.colorVariants)) return false;
    return value.colorVariants.every((color: unknown) => {
        if (!isRecord(color) || (color.inventory !== undefined && !isInventory(color.inventory))) return false;
        if (color.sizes === undefined) return true;
        return Array.isArray(color.sizes) && color.sizes.every(
            (size: unknown) => isRecord(size) && isInventory(size.inventory),
        );
    });
};

const resetInventory = (source: ItemAttributes): ItemAttributes => {
    // 保存済みJSONBはTypeScriptの型だけでは構造を保証できない。
    if (!hasCopyableInventory(source)) {
        throw new AppError("ITEM_ATTRIBUTES_INVALID", 500, "商品の在庫情報を確認できません。時間をおいてもう一度お試しください。");
    }
    const attributes = structuredClone(source);

    if (attributes.inventory) {
        attributes.inventory.current = attributes.inventory.initial;
    }
    for (const colorVariant of attributes.colorVariants ?? []) {
        if (colorVariant.inventory) {
            colorVariant.inventory.current = colorVariant.inventory.initial;
        }
        for (const size of colorVariant.sizes ?? []) {
            size.inventory.current = size.inventory.initial;
        }
    }

    return attributes;
};

// POST /item-editing/copy
// summary: 販売中商品からitem_editingへのコピー
// page: /item/[id]
export const createItemEditingCopyUseCase = async ({ userId, itemId }: Params): Promise<number> => {
    return await sequelize.transaction(async (transaction) => {
        const item = await getMyItemWithVideoSaleShipping({ itemId, userId, transaction });
        if (!item || item.status !== "active") {
            throw new AppError("ITEM_NOT_FOUND", 404);
        }

        const itemEditing = await createItemEditingCopy({
            data: {
                item_id: null,
                seller_id: userId,
                name: item.name,
                detail: item.detail,
                image_url: item.image_url,
                item_condition_id: item.item_condition_id,
                first_image_url: item.first_image_url,
                gender_type: item.gender_type,
                age_type: item.age_type,
                recommend: item.recommend,
                category_id: item.category_id,
                brand_id: item.brand_id,
                brand_aliases_id: item.brand_aliases_id,
                attributes: resetInventory(item.attributes),
                thumbnail_url: item.Video?.thumbnail_url ?? null,
                title: item.Video?.title ?? null,
                summary: item.Video?.summary ?? null,
                duration: item.Video?.duration ?? null,
                original_url: item.Video?.original_url ?? null,
                converted_url: item.Video?.converted_url ?? null,
                video_status: item.Video?.status ?? null,
                before_price: item.Sale?.before_price ?? null,
                price: item.Sale?.before_price ?? null,
                discount_rate: null,
                discount_amount: null,
                sale_flag: false,
                shipping_day_id: item.ItemShippingProfile?.shipping_day_id ?? null,
                shipping_service_id: item.ItemShippingProfile?.shipping_service_id ?? null,
                shipping_place_id: item.ItemShippingProfile?.shipping_place_id ?? null,
                shipping_service_free_text: item.ItemShippingProfile?.shipping_service_free_text ?? null,
            },
            transaction,
        });

        return itemEditing.id;
    });
};
