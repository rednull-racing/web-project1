import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { updateConfirm, updateItemEditingImage } from "../../services/itemEditing/command.js";
import { getMyItemEditing } from "../../services/itemEditing/query.js";
import { ItemUploadBody } from "../../validators/body/items.js";
import { buildSignedUrls } from "./shared/buildSignedUrls.js";
import { resolveBrand } from "./shared/resolveBrand.js";
import { validateMaster } from "./shared/validateMaster.js";
import { validateNumber } from "./shared/validateNumber.js";

type Params = {
    itemEditingId: number;
    userId: number;
    body: ItemUploadBody;
};

// PUT /item-editing/:id
// summary: 商品アップロード
// page: /upload/[id]
export const uploadItemEditingConfirmUseCase = async ({ itemEditingId, userId, body }: Params) => {
    const { attributes, shipping, videoMeta, itemMeta, genderAge } = body;

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
    if (!finalImageUrls) throw new AppError("ITEM_IMAGE_NULL", 400);

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

    // ブランドチェック
    const brandResult = await resolveBrand({ brandId, body });

    // データ更新
    await sequelize.transaction(async (t) => {
        await updateConfirm({
            itemEditing,
            data: {
                name: itemMeta.name,
                detail: itemMeta.detail ?? "",
                price: body.price,
                first_image_url: finalImageUrls[0],
                category_id: categoryId,
                gender_type: genderAge.gender,
                age_type: genderAge.age,
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

        await updateItemEditingImage({ itemEditing, urls: finalImageUrls, transaction: t });
    });

    return {
        videoSignedUrl,
        thumbnailSignedUrl,
        itemImageSignedUrls,
        attributesImageSignedUrls,
    };
};
