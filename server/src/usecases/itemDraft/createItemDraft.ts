import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { CreateItemDraft, updateItemDraftImage } from "../../services/itemDraft/command.js";
import { deleteItemEditing } from "../../services/itemEditing/command.js";
import { getMyItemEditing } from "../../services/itemEditing/query.js";
import type { CreateItemDraftBody } from "../../validators/body/itemDraft.js";
import { buildSignedUrls } from "../shared/buildSignedUrls.js";
import { resolveBrand } from "../shared/resolveBrand.js";
import { validateMaster } from "../shared/validateMaster.js";
import { validateNumber } from "../shared/validateNumber.js";

type Params = {
    userId: number;
    body: CreateItemDraftBody;
};

// POST /item-draft
// summary: 下書き商品作成
// page: /upload/[id]
export const createItemDraftUseCase = async ({ userId, body }: Params) => {
    const { itemEditingId, attributes, shipping, videoMeta, itemMeta, genderAge } = body;

    // ItemEditing取得
    const itemEditing = await getMyItemEditing({ itemEditingId, userId });

    if (!itemEditing) {
        throw new AppError("ITEM_EDITING_NOT_FOUND", 404);
    }

    // 署名付きURL生成
    const {
        videoSignedUrl,
        videoUrl,
        thumbnailSignedUrl,
        thumbnailUrl,
        itemImageSignedUrls,
        finalImageUrls,
        attributesImageSignedUrls,
        finalAttributesImageUrls,
    } = await buildSignedUrls({ itemEditingId, userId, itemEditing, body });

    if (!videoUrl) throw new AppError("VIDEO_URL_NULL", 400);
    if (!thumbnailUrl) throw new AppError("THUMBNAIL_URL_NULL", 400);
    if (!finalImageUrls || finalImageUrls.length === 0) throw new AppError("ITEM_IMAGE_NULL", 400);
    if (finalImageUrls.length > 10) {
        throw new AppError("ITEM_IMAGE_LIMIT_EXCEEDED", 400, "商品画像は10枚以内にしてください。");
    }

    // 数値チェック
    const { categoryId, conditionId, dayId, serviceId, placeId, brandId } = await validateNumber({ body });

    // マスターテーブルチェック
    const categoryOption = await validateMaster({
        categoryId,
        conditionId,
        dayId,
        serviceId,
        placeId,
    });

    // データ更新
    const itemDraftId = await sequelize.transaction(async (t) => {
        // 作成直前に再認可し、commitまで参照元の削除・所有者変更を待機させる。
        const currentItemEditing = await getMyItemEditing({ itemEditingId, userId, transaction: t });
        if (!currentItemEditing) {
            throw new AppError("ITEM_EDITING_NOT_FOUND", 404);
        }

        // ブランドチェック兼brandAliases作成
        const brandResult = await resolveBrand({ brandId, body, transaction: t });

        const itemDraft = await CreateItemDraft({
            data: {
                seller_id: userId,
                name: itemMeta.name,
                detail: itemMeta.detail ?? "",
                price: body.price,
                first_image_url: finalImageUrls[0],
                category_id: categoryId,
                gender_type: genderAge.gender ?? "unisex",
                age_type: genderAge.age ?? "both",
                brand_id: brandResult.brand?.id ?? null,
                brand_aliases_id: brandResult.alias?.id ?? null,
                item_condition_id: conditionId,

                attributes: {
                    inventory: {
                        initial: attributes.allInventory ?? 1,
                        current: attributes.allInventory ?? 1,
                        low_stock_ratio: 0.2,
                    },
                    colorVariants:
                        attributes.colorVariants.length > 0
                            ? attributes.colorVariants.map((v) => ({
                                  uiId: v.uiId,
                                  color: v.color ?? undefined,
                                  inventory: {
                                      initial: v.inventory ?? 1,
                                      current: v.inventory ?? 1,
                                      low_stock_ratio: 0.2,
                                  },
                                  image_url: finalAttributesImageUrls[v.uiId] ?? undefined,
                                  sizes: v.sizes.map((s) => ({
                                      size: s.size ?? undefined,
                                      inventory: {
                                          initial: s.inventory ?? 1,
                                          current: s.inventory ?? 1,
                                          low_stock_ratio: 0.2,
                                      },
                                  })),
                              }))
                            : undefined,
                    materials:
                        (attributes?.materials?.length ?? 0) > 0
                            ? attributes.materials.map((m) => ({
                                  name: m.name,
                                  ratio: m.ratio,
                              }))
                            : undefined,
                    body_category: categoryOption?.body_category ?? undefined,
                    lifestyle_category: categoryOption?.lifestyle_category ?? undefined,
                    layer: categoryOption?.layer ?? undefined,
                },

                title: videoMeta.title,
                summary: videoMeta.summary ?? "",
                original_url: videoUrl,
                thumbnail_url: thumbnailUrl,

                before_price: body.price,

                shipping_day_id: dayId,
                shipping_service_id: serviceId,
                shipping_place_id: placeId,
                shipping_service_free_text: shipping.freeText,
            },
            transaction: t,
        });

        await updateItemDraftImage({ itemDraft, urls: finalImageUrls, transaction: t });
        await deleteItemEditing({ itemEditing: currentItemEditing, transaction: t });
        return itemDraft.id;
    });

    return {
        itemDraftId,
        videoSignedUrl,
        thumbnailSignedUrl,
        itemImageSignedUrls,
        attributesImageSignedUrls,
    };
};
