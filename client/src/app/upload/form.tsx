"use client";

import { TopLoader } from "@/components";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../lib/api/apiError";
import { sleep } from "../../lib/sleep";
import { fetchDraft, fetchMain } from "./api/item";
import { AttributesInput, AttributesValue } from "./attributes";
import { BrandInput, BrandValue } from "./brandInput";
import { Category, CategoryValue } from "./category";
import { ConditionInput, ConditionValue } from "./condition";
import { GenderAge, GenderAgeValue } from "./genderAge";
import { useFileUpload } from "./hooks/useFileUpload";
import { useUpload } from "./hooks/useUpload";
import { ItemImage } from "./itemImage";
import { ItemNameDetail, ItemNameDetailValue } from "./itemNameDetail";
import { MaterialInput, MaterialValue } from "./material";
import { PriceInput, PriceValue } from "./price";
import { ShippingInput, ShippingValue } from "./shipping";
import {
    Categories,
    Item,
    ItemConditionOption,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
} from "./types/types";
import styles from "./upload.module.css";
import UploadUI from "./uploadUI";
import { VideoInput, VideoInputValue } from "./videoInput";

type Props = {
    itemId: string;
    item: Item;
    category: Categories[];
    allCondition: ItemConditionOption[];
    allDay: ShippingDayOption[];
    allService: ShippingServiceOption[];
    allPlace: TodouhukenOption[];
    hasShop: boolean;
    page: "normal" | "edit";
};

type ItemImage = {
    id: string;
    uploaded: boolean;
    file: File | null;
    preview: string;
};

export const Form = ({ itemId, item, category, allCondition, allDay, allService, allPlace, hasShop, page }: Props) => {
    const initialThumbnailPreview = item.Video?.thumbnail_url ?? null;
    const existingVideoUrl = item.Video?.converted_url ?? item.Video?.original_url ?? null;

    const [videoInput, setVideoInput] = useState<VideoInputValue>({
        videoFile: null,
        thumbnailFile: null,
        thumbnailPreview: initialThumbnailPreview,
        title: item.Video?.title ?? "",
        summary: item.Video?.summary ?? "",
        videoUploaded: !!existingVideoUrl,
        thumbnailUploaded: !!initialThumbnailPreview,
    });

    const [itemNameDetail, setItemNameDetail] = useState<ItemNameDetailValue>({
        name: item.name ?? "",
        detail: item.detail ?? "",
    });

    const [categoryValue, setCategoryValue] = useState<CategoryValue>({
        id: item.Category?.id ?? "",
        name: item.Category?.name ?? "",
        parent_id: item.Category?.parent_id ?? null,
        level: item.Category?.level ?? 0,
    });

    const [categoryConstraint, setCategoryConstraint] = useState<{
        allowed_gender: "men" | "women" | "unisex" | null;
        allowed_age: "adult" | "kids" | "both" | null;
    } | null>(
        item.Category
            ? {
                  allowed_gender: item.Category?.allowed_gender ?? null,
                  allowed_age: item.Category?.allowed_age ?? null,
              }
            : null,
    );

    const [genderAgeValue, setGenderAgeValue] = useState<GenderAgeValue>({
        gender_type: item.gender_type ?? "unisex",
        age_type: item.age_type ?? "both",
    });

    const [brandValue, setBrandValue] = useState<BrandValue>({
        id: item.Brand?.id ?? null,
        name: item.Brand?.name ?? "",
    });

    const initialAttributesValue: AttributesValue = {
        all_inventory: item.attributes?.inventory?.current ?? 1,
        colorVariants:
            item.attributes?.colorVariants?.map((v) => ({
                _uiId: v.uiId ?? crypto.randomUUID(),
                color: v.color ?? null,
                inventory: v.inventory?.current ?? 1,
                image: null,
                image_uploaded: true,
                sizes: (v.sizes ?? []).map((s) => ({
                    size: s.size ?? null,
                    inventory: s.inventory.current ?? 1,
                })),
            })) ?? [],
    };

    const initialAttributesImageUrlMap = new Map<string, string>();

    item.attributes?.colorVariants?.forEach((v, i) => {
        if (v.image_url && initialAttributesValue.colorVariants[i]) {
            initialAttributesImageUrlMap.set(initialAttributesValue.colorVariants[i]._uiId, v.image_url);
        }
    });

    const [attributesValue, setAttributesValue] = useState<AttributesValue>(initialAttributesValue);

    const [attributesImageMap, setAttributesImageMap] = useState<Map<string, string>>(initialAttributesImageUrlMap);

    const [materialValue, setMaterialValue] = useState<MaterialValue>({
        materials: (item.attributes?.materials ?? []).map((m) => ({
            name: m.name ?? "",
            ratio: m.ratio ?? 1,
        })),
    });

    const [conditionValue, setConditionValue] = useState<ConditionValue>({
        id: item.ItemConditionOption?.id ?? "",
        name: item.ItemConditionOption?.name ?? "",
    });

    const shipping = item.ItemShippingProfile;

    const [shippingValue, setShippingValue] = useState<ShippingValue>({
        day_id: shipping?.ShippingDayOption?.id ?? null,
        day_name: shipping?.ShippingDayOption?.name ?? null,
        service_id: shipping?.ShippingServiceOption?.id ?? null,
        service_name: shipping?.ShippingServiceOption?.name ?? null,
        place_id: shipping?.TodouhukenOption?.id ?? null,
        place_name: shipping?.TodouhukenOption?.name ?? null,
        free_text: shipping?.shipping_service_free_text ?? null,
    });

    const [priceValue, setPriceValue] = useState<PriceValue>({
        price: item.Sale?.before_price && !Number.isNaN(item.Sale?.before_price) ? item.Sale?.before_price : item.price,
    });

    const initialItemImage = (item.image_url ?? []).map((url) => ({
        id: crypto.randomUUID(),
        file: null,
        preview: url,
        uploaded: true,
    }));

    const [itemImages, setItemImages] = useState<ItemImage[]>(initialItemImage);

    const [loading, setLoading] = useState(false);
    const [draftLoading, setDraftLoading] = useState(false);

    const videoRef = useRef<HTMLInputElement | null>(null);
    const thumbnailRef = useRef<HTMLInputElement | null>(null);

    const { validateUpload, validateForDraft, createBody } = useUpload();

    const { videoUploadAndConvert, thumbnailUpload, itemImageUpload, attributesImageUpload } = useFileUpload();

    const addItemImage = (files: FileList) => {
        const newImages = Array.from(files)
            .slice(0, 10 - itemImages.length)
            .map((file) => ({
                id: crypto.randomUUID(),
                file,
                preview: URL.createObjectURL(file),
                uploaded: false,
            }));

        setItemImages((prev) => [...prev, ...newImages]);
    };

    const removeItemImage = (index: number) => {
        setItemImages((prev) => prev.filter((_, i) => i !== index));
    };

    const upload = async () => {
        setLoading(true);

        const resolveAttributesImage = (v: (typeof attributesValue.colorVariants)[number]) => {
            if (v.image) {
                return {
                    name: v.image.name,
                    type: v.image.type,
                    uploaded: false,
                };
            }

            const existingUrl = initialAttributesImageUrlMap.get(v._uiId);
            if (existingUrl) {
                return {
                    name: existingUrl.split("/").pop(),
                    type: null,
                    uploaded: true,
                };
            }

            return null;
        };

        const params = {
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
        };

        const validate = validateUpload(params);
        if (!validate.ok) {
            toast.error(validate.message ?? "");
            setLoading(false);
            return;
        }

        const body = createBody(params);

        try {
            const data = await fetchMain(itemId, body);

            // 動画アップロード
            const videoOk = await videoUploadAndConvert({
                target: "editing",
                videoFile: videoInput.videoFile,
                videoSignedUrl: data.videoSignedUrl,
                itemEditingId: itemId,
            });

            if (!videoOk) {
                setLoading(false);
                return;
            }

            // サムネイルアップロード
            const thumbnailOk = await thumbnailUpload({
                thumbnailFile: videoInput.thumbnailFile,
                thumbnailSignedUrl: data.thumbnailSignedUrl,
            });

            if (!thumbnailOk) {
                setLoading(false);
                return;
            }

            // 商品画像アップロード
            const itemImagesOk = await itemImageUpload({
                itemImageFiles: itemImages,
                itemImageSignedUrls: data.itemImageSignedUrls,
            });

            if (!itemImagesOk) {
                setLoading(false);
                return;
            }

            // attributes.imagesアップロード
            const attributesImagesOk = await attributesImageUpload({
                attributesValue: attributesValue,
                signedUrlMap: data.attributesImageSignedUrls,
            });

            if (!attributesImagesOk) {
                setLoading(false);
                return;
            }

            toast.success("商品データを登録しました");
            setLoading(false);
            await sleep(1500);

            if (page === "edit") {
                if (item.status === "active") {
                    window.location.assign(`/item/${itemId}`);
                } else {
                    window.location.assign(`/item/confirm/${itemId}`);
                }
            } else {
                window.location.assign(`/item/confirm/${itemId}`);
            }
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("データ作成に失敗しました");
            } else {
                alert("システムエラーが発生しました。時間をおいて再試行してください");
            }

            setLoading(false);
        }
    };

    const draft = async () => {
        setDraftLoading(true);

        const resolveAttributesImage = (v: (typeof attributesValue.colorVariants)[number]) => {
            // 新規アップロード
            if (v.image && !v.image_uploaded) {
                return {
                    name: v.image.name,
                    type: v.image.type,
                    uploaded: false,
                };
            }

            // 既存画像
            const existingUrl = initialAttributesImageUrlMap.get(v._uiId);
            if (existingUrl) {
                return {
                    name: existingUrl.split("/").pop(),
                    type: null,
                    uploaded: true,
                };
            }

            return null;
        };

        const params = {
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
        };

        const validate = validateForDraft(params);
        if (!validate.ok) {
            toast.error(validate.message ?? "");
            setDraftLoading(false);
            return;
        }

        const body = createBody(params);

        try {
            const data = await fetchDraft(itemId, body);

            // 動画アップロード
            const videoOk = await videoUploadAndConvert({
                target: "draft",
                videoFile: videoInput.videoFile,
                videoSignedUrl: data.videoSignedUrl,
                itemDraftId: data.itemDraftId,
            });

            if (!videoOk) {
                setDraftLoading(false);
                return;
            }

            // サムネイルアップロード
            const thumbnailOk = await thumbnailUpload({
                thumbnailFile: videoInput.thumbnailFile,
                thumbnailSignedUrl: data.thumbnailSignedUrl,
            });

            if (!thumbnailOk) {
                setDraftLoading(false);
                return;
            }

            // 商品画像アップロード
            const itemImagesOk = await itemImageUpload({
                itemImageFiles: itemImages,
                itemImageSignedUrls: data.itemImageSignedUrls,
            });

            if (!itemImagesOk) {
                setDraftLoading(false);
                return;
            }

            // attributes.imagesアップロード
            const attributesImagesOk = await attributesImageUpload({
                attributesValue: attributesValue,
                signedUrlMap: data.attributesImageSignedUrls,
            });

            if (!attributesImagesOk) {
                setDraftLoading(false);
                return;
            }

            toast.success("下書き保存しました");
            setDraftLoading(false);
            await sleep(1500);

            window.location.assign("/item-list/draft");
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("下書き保存に失敗しました");
            } else {
                alert("システムエラーが発生しました。時間をおいて再試行してください");
            }

            setDraftLoading(false);
        }
    };

    return (
        <UploadUI title="商品をアップロード">
            <TopLoader loading={loading} />
            <TopLoader loading={draftLoading} />

            <h2 className={styles.subtitle}>動画をアップロード</h2>

            <VideoInput
                value={videoInput}
                onChange={setVideoInput}
                videoRef={videoRef}
                thumbnailRef={thumbnailRef}
                existingVideoUrl={existingVideoUrl}
            />

            <h2 className={styles.subtitle}>商品をアップロード</h2>

            <ItemImage images={itemImages} onAdd={addItemImage} onRemove={removeItemImage} />

            <ItemNameDetail value={itemNameDetail} onChange={setItemNameDetail} />

            <Category
                level1List={category}
                value={categoryValue}
                onChange={setCategoryValue}
                onConstraintChange={setCategoryConstraint}
            />

            <GenderAge value={genderAgeValue} onChange={setGenderAgeValue} categoryConstraint={categoryConstraint} />

            <BrandInput value={brandValue} onChange={setBrandValue} />

            {hasShop && (
                <AttributesInput
                    value={attributesValue}
                    onChange={setAttributesValue}
                    imageUrlMap={attributesImageMap}
                />
            )}

            <MaterialInput value={materialValue} onChange={setMaterialValue} />

            <ConditionInput allCondition={allCondition} value={conditionValue} onChange={setConditionValue} />

            <h2 className={styles.subtitle}>配送について</h2>

            <ShippingInput
                allDay={allDay}
                allService={allService}
                allPlace={allPlace}
                value={shippingValue}
                onChange={setShippingValue}
            />

            <h2 className={styles.subtitle}>価格</h2>

            <PriceInput value={priceValue} onChange={setPriceValue} />

            <div className={styles.formButtonDiv}>
                <button type="button" className={styles.uploadButton} onClick={upload} disabled={loading}>
                    {loading ? "登録中..." : "出品する"}
                </button>

                {page !== "edit" && (
                    <button type="button" className={styles.draftButton} onClick={draft} disabled={draftLoading}>
                        {draftLoading ? "保存中..." : "下書き保存する"}
                    </button>
                )}
            </div>
        </UploadUI>
    );
};
