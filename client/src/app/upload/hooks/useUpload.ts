import { AttributesValue } from "../attributes";
import { BrandValue } from "../brandInput";
import { CategoryValue } from "../category";
import { ConditionValue } from "../condition";
import { GenderAgeValue } from "../genderAge";
import { ItemImageValue } from "../itemImage";
import { ItemNameDetailValue } from "../itemNameDetail";
import { MaterialValue } from "../material";
import { PriceValue } from "../price";
import { ShippingValue } from "../shipping";
import { Body } from "../types/uploadType";
import { VideoInputValue } from "../videoInput";

export type UploadMeta = {
    name?: string;
    type: string | null;
    uploaded: boolean;
};

export type UploadParams = {
    videoInput: VideoInputValue;
    itemImages: ItemImageValue[];
    itemNameDetail: ItemNameDetailValue;
    categoryValue: CategoryValue;
    genderAgeValue: GenderAgeValue;
    brandValue: BrandValue;
    attributesValue: AttributesValue;
    materialValue: MaterialValue;
    conditionValue: ConditionValue;
    shippingValue: ShippingValue;
    priceValue: PriceValue;

    resolveAttributesImage: (v: AttributesValue["colorVariants"][number]) => UploadMeta | null;
};

export type SubmitType = {
    itemId: string;
    body: Body;
    accessToken: string;
};

type ValidationResult = {
    ok: boolean;
    message?: string;
};

export const useUpload = () => {
    const validateUpload = (params: UploadParams): ValidationResult => {
        const totalRatio = params.materialValue.materials.reduce((sum, m) => sum + (m.ratio ?? 0), 0);
        if (totalRatio > 100) {
            return { ok: false, message: "素材の割合が100%を超えています" };
        }

        const colorTotalInventory = params.attributesValue.colorVariants.reduce(
            (sum, v) => sum + (v.inventory ?? 0),
            0,
        );
        if (colorTotalInventory >= 2 && !(colorTotalInventory === params.attributesValue.all_inventory)) {
            return { ok: false, message: "カラーの出品点数と合計点数が一致していません" };
        }

        const sizeTotalInventory = params.attributesValue.colorVariants.reduce(
            (sum, v) => sum + v.sizes.reduce((sizeSum, s) => sizeSum + (s.inventory ?? 0), 0),
            0,
        );
        if (sizeTotalInventory >= 2 && !(sizeTotalInventory === params.attributesValue.all_inventory)) {
            return { ok: false, message: "サイズの出品点数と合計点数が一致していません" };
        }

        const required = {
            videoFile: {
                ok: !!(params.videoInput.videoFile || params.videoInput.videoUploaded),
                message: "動画ファイルを選択してください",
            },
            thumbnailFile: {
                ok: !!(params.videoInput.thumbnailFile || params.videoInput.thumbnailUploaded),
                message: "サムネイルを選択してください",
            },
            title: {
                ok: params.videoInput.title.trim().length > 0,
                message: "動画タイトルを入力してください",
            },
            itemImages: {
                ok: params.itemImages.length > 0,
                message: "商品画像を選択してください",
            },
            name: {
                ok: params.itemNameDetail.name.trim().length > 0,
                message: "商品名を入力してください",
            },
            category: {
                ok: !!params.categoryValue.id,
                message: "カテゴリーを選択してください",
            },
            gender_type: {
                ok: !!params.genderAgeValue.gender_type,
                message: "着用対象（性別）を選択してください",
            },
            age_type: {
                ok: !!params.genderAgeValue.age_type,
                message: "着用対象（年齢）を選択してください",
            },
            all_inventory: {
                ok: params.attributesValue.all_inventory > 0,
                message: "出品点数を1点以上入力してください",
            },
            condition: {
                ok: !!params.conditionValue.id,
                message: "商品の状態を選択してください",
            },
            shipping_day: {
                ok: !!params.shippingValue.day_id,
                message: "発送までの日数を選択してください",
            },
            shipping_service: {
                ok: !!params.shippingValue.service_id,
                message: "配送方法を選択してください",
            },
            shipping_place: {
                ok: !!params.shippingValue.place_id,
                message: "発送元地域を選択してください",
            },
            price: {
                ok: params.priceValue.price >= 300 && params.priceValue.price <= 1000000,
                message: "価格を300~1,000,000円の間で設定してください",
            },
        };

        const errors = Object.values(required)
            .filter((r) => !r.ok)
            .map((r) => r.message);

        if (errors.length) {
            console.error("バリデーションエラー：", errors);
            return { ok: false, message: errors[0] };
        }

        return { ok: true };
    };

    const validateForDraft = (params: UploadParams): ValidationResult => {
        const totalRatio = params.materialValue.materials.reduce((sum, m) => sum + (m.ratio ?? 0), 0);
        if (totalRatio > 100) {
            return { ok: false, message: "素材の割合が100%を超えています" };
        }

        const colorTotalInventory = params.attributesValue.colorVariants.reduce(
            (sum, v) => sum + (v.inventory ?? 0),
            0,
        );
        if (colorTotalInventory >= 2 && colorTotalInventory > params.attributesValue.all_inventory) {
            return { ok: false, message: "カラーの出品点数が合計点数を超過しています" };
        }

        const sizeTotalInventory = params.attributesValue.colorVariants.reduce(
            (sum, v) => sum + v.sizes.reduce((sizeSum, s) => sizeSum + (s.inventory ?? 0), 0),
            0,
        );
        if (sizeTotalInventory >= 2 && sizeTotalInventory > params.attributesValue.all_inventory) {
            return { ok: false, message: "サイズの出品点数が合計点数を超過しています" };
        }

        return { ok: true };
    };

    const createBody = (params: UploadParams) => {
        const {
            videoInput,
            itemImages,
            itemNameDetail,
            categoryValue,
            genderAgeValue,
            brandValue,
            attributesValue,
            materialValue,
            conditionValue,
            shippingValue,
            priceValue,
            resolveAttributesImage,
        } = params;

        const itemImagesUpload: UploadMeta[] = itemImages.map((img) => {
            if (!img.uploaded && img.file instanceof File) {
                return {
                    name: img.file.name,
                    type: img.file.type,
                    uploaded: false, // 新規アップロード
                };
            }

            const fileName = (img.preview ?? "").split("/").pop() || "unknown";

            return {
                name: fileName,
                type: null,
                uploaded: true,
            };
        });

        return {
            video: {
                name: videoInput.videoFile?.name ?? "unknown",
                type: videoInput.videoFile?.type,
                uploaded: videoInput.videoUploaded,
            },
            thumbnail: {
                name: videoInput.thumbnailFile?.name ?? "unknown",
                type: videoInput.thumbnailFile?.type,
                uploaded: videoInput.thumbnailUploaded,
            },
            videoMeta: {
                title: videoInput.title,
                summary: videoInput.summary,
            },
            itemImages: itemImagesUpload,
            itemMeta: {
                name: itemNameDetail.name,
                detail: itemNameDetail.detail,
            },
            category: {
                id: categoryValue.id == null || categoryValue.id === "" ? null : String(categoryValue.id),
                name: categoryValue.name,
                parent_id: categoryValue.parent_id == null ? null : String(categoryValue.parent_id),
                level: categoryValue.id ? categoryValue.level : 1,
            },
            genderAge: {
                gender: genderAgeValue.gender_type,
                age: genderAgeValue.age_type,
            },
            brand: {
                id: brandValue.id == null ? null : String(brandValue.id),
                name: brandValue.name,
            },
            attributes: {
                allInventory: attributesValue.all_inventory,
                colorVariants: attributesValue.colorVariants.map((v) => ({
                    uiId: v._uiId,
                    color: v.color ?? undefined,
                    inventory: v.inventory,
                    image: (() => {
                        const image = resolveAttributesImage(v);
                        return image
                            ? { ...image, name: image.name ?? "unknown", type: image.type ?? undefined }
                            : undefined;
                    })(),
                    sizes: v.sizes.map((s) => ({
                        size: s.size ?? "",
                        inventory: s.inventory,
                    })),
                })),
                materials: materialValue.materials.map((m) => ({
                    name: m.name,
                    ratio: m.ratio,
                })),
            },
            condition: {
                id: String(conditionValue.id),
                name: conditionValue.name,
            },
            shipping: {
                day: shippingValue.day_id == null ? null : String(shippingValue.day_id),
                service: shippingValue.service_id == null ? null : String(shippingValue.service_id),
                place: shippingValue.place_id == null ? null : String(shippingValue.place_id),
                freeText: shippingValue.free_text,
            },
            price: Number(priceValue.price),
        };
    };

    return {
        validateUpload,
        validateForDraft,
        createBody,
    };
};
