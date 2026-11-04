"use client";

import { TopLoader } from "@/components";
import { useEffect, useRef, useState } from "react";
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
    ItemConditionOption,
    ItemEditing,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
} from "./types/types";
import styles from "./upload.module.css";
import UploadUI from "./uploadUI";
import { VideoInput, VideoInputValue } from "./videoInput";

type Props = {
    itemEditingId: string;
    itemEditing: ItemEditing;
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

export const Form = ({
    itemEditingId,
    itemEditing,
    category,
    allCondition,
    allDay,
    allService,
    allPlace,
    hasShop,
    page,
}: Props) => {
    const initialThumbnailPreview = itemEditing.thumbnail_url ?? null;
    const existingVideoUrl = itemEditing.converted_url ?? itemEditing.original_url ?? null;

    const [videoInput, setVideoInput] = useState<VideoInputValue>({
        videoFile: null,
        thumbnailFile: null,
        thumbnailPreview: initialThumbnailPreview,
        title: itemEditing.title ?? "",
        summary: itemEditing.summary ?? "",
        videoUploaded: !!existingVideoUrl,
        thumbnailUploaded: !!initialThumbnailPreview,
    });

    const [itemNameDetail, setItemNameDetail] = useState<ItemNameDetailValue>({
        name: itemEditing.name ?? "",
        detail: itemEditing.detail ?? "",
    });

    const [categoryValue, setCategoryValue] = useState<CategoryValue>({
        id: itemEditing.Category?.id ?? "",
        name: itemEditing.Category?.name ?? "",
        parent_id: itemEditing.Category?.parent_id ?? null,
        level: itemEditing.Category?.level ?? 0,
    });

    const [categoryConstraint, setCategoryConstraint] = useState<{
        allowed_gender: "men" | "women" | "unisex" | null;
        allowed_age: "adult" | "kids" | "both" | null;
    } | null>(
        itemEditing.Category
            ? {
                  allowed_gender: itemEditing.Category?.allowed_gender ?? null,
                  allowed_age: itemEditing.Category?.allowed_age ?? null,
              }
            : null,
    );

    const [genderAgeValue, setGenderAgeValue] = useState<GenderAgeValue>({
        gender_type: itemEditing.gender_type ?? "unisex",
        age_type: itemEditing.age_type ?? "both",
    });

    const [brandValue, setBrandValue] = useState<BrandValue>({
        id: itemEditing.Brand?.id ?? null,
        name: itemEditing.Brand?.name ?? "",
    });

    const [initialAttributes] = useState(() => {
        const value: AttributesValue = {
            all_inventory: itemEditing.attributes?.inventory?.current ?? 1,
            colorVariants:
                itemEditing.attributes?.colorVariants?.map((v) => ({
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

        const images = new Map<string, string>();
        itemEditing.attributes?.colorVariants?.forEach((variant, index) => {
            if (variant.image_url && value.colorVariants[index]) {
                images.set(value.colorVariants[index]._uiId, variant.image_url);
            }
        });
        return { value, images };
    });
    const [attributesValue, setAttributesValue] = useState(initialAttributes.value);
    const attributesImageMap = initialAttributes.images;

    const [materialValue, setMaterialValue] = useState<MaterialValue>({
        materials: (itemEditing.attributes?.materials ?? []).map((m) => ({
            name: m.name ?? "",
            ratio: m.ratio ?? 1,
        })),
    });

    const [conditionValue, setConditionValue] = useState<ConditionValue>({
        id: itemEditing.ItemConditionOption?.id ?? "",
        name: itemEditing.ItemConditionOption?.name ?? "",
    });

    const [shippingValue, setShippingValue] = useState<ShippingValue>({
        day_id: itemEditing.ShippingDayOption?.id ?? null,
        day_name: itemEditing.ShippingDayOption?.name ?? null,
        service_id: itemEditing.ShippingServiceOption?.id ?? null,
        service_name: itemEditing.ShippingServiceOption?.name ?? null,
        place_id: itemEditing.TodouhukenOption?.id ?? null,
        place_name: itemEditing.TodouhukenOption?.name ?? null,
        free_text: itemEditing.shipping_service_free_text ?? null,
    });

    const [priceValue, setPriceValue] = useState<PriceValue>({
        price:
            itemEditing.before_price && !Number.isNaN(itemEditing.before_price)
                ? itemEditing.before_price
                : itemEditing.price,
    });

    const [itemImages, setItemImages] = useState<ItemImage[]>(() =>
        (itemEditing.image_url ?? []).map((url) => ({
            id: crypto.randomUUID(),
            file: null,
            preview: url,
            uploaded: true,
        })),
    );
    const [loading, setLoading] = useState(false);
    const [draftLoading, setDraftLoading] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const busy = loading || draftLoading;
    const submitting = useRef(false);
    const mounted = useRef(true);
    const imageUrls = useRef(new Set<string>());
    const saved = useRef<{
        action: "main" | "draft";
        key: string;
        files: Array<File | null>;
        response: Awaited<ReturnType<typeof fetchMain>> & { itemDraftId?: number };
    } | null>(null);

    const videoRef = useRef<HTMLInputElement | null>(null);
    const thumbnailRef = useRef<HTMLInputElement | null>(null);

    const { validateUpload, validateForDraft, createBody } = useUpload();

    const { videoUploadAndConvert, thumbnailUpload, itemImageUpload, attributesImageUpload, cancelUploads } =
        useFileUpload();

    useEffect(() => {
        mounted.current = true;
        const previews = imageUrls.current;
        return () => {
            mounted.current = false;
            cancelUploads();
            previews.forEach((url) => URL.revokeObjectURL(url));
            previews.clear();
        };
    }, [cancelUploads]);

    const addItemImage = (files: FileList) => {
        const newImages = Array.from(files)
            .slice(0, 10 - itemImages.length)
            .map((file) => ({
                id: crypto.randomUUID(),
                file,
                preview: (() => {
                    const url = URL.createObjectURL(file);
                    imageUrls.current.add(url);
                    return url;
                })(),
                uploaded: false,
            }));

        setItemImages((prev) => [...prev, ...newImages]);
    };

    const removeItemImage = (index: number) => {
        const preview = itemImages[index]?.preview;
        if (preview && imageUrls.current.delete(preview)) URL.revokeObjectURL(preview);
        setItemImages((prev) => prev.filter((_, i) => i !== index));
    };

    const submit = async (action: "main" | "draft") => {
        if (submitting.current || (draftSaved && action !== "draft")) return;
        submitting.current = true;
        const setPending = action === "main" ? setLoading : setDraftLoading;
        setPending(true);
        let navigating = false;
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
            resolveAttributesImage: (variant: AttributesValue["colorVariants"][number]) => {
                if (variant.image) return { name: variant.image.name, type: variant.image.type, uploaded: false };
                const url = attributesImageMap.get(variant._uiId);
                return url ? { name: url.split("/").pop(), type: null, uploaded: true } : null;
            },
        };
        try {
            const validation = action === "main" ? validateUpload(params) : validateForDraft(params);
            if (!validation.ok) {
                toast.error(validation.message ?? "");
                return;
            }
            const body = createBody(params);
            const key = JSON.stringify(body);
            const files = [
                videoInput.videoFile,
                videoInput.thumbnailFile,
                ...itemImages.map((image) => image.file),
                ...attributesValue.colorVariants.map((variant) => variant.image),
            ];
            const previous = saved.current;
            const reusable =
                previous?.action === action &&
                previous.key === key &&
                previous.files.length === files.length &&
                previous.files.every((file, index) => file === files[index]);
            // 下書きPOSTで削除済みの編集セッションへ再POSTしない。転送失敗時は同じ署名と保存先で再開する。
            if (draftSaved && !reusable) {
                toast.error("保存済みの下書きは転送の再試行のみ可能です");
                return;
            }
            const data: Awaited<ReturnType<typeof fetchMain>> & { itemDraftId?: number } =
                reusable && previous
                    ? previous.response
                    : action === "main"
                      ? await fetchMain(itemEditingId, body)
                      : await fetchDraft(itemEditingId, body);
            if (!mounted.current) return;
            if (action === "draft" && !("itemDraftId" in data && typeof data.itemDraftId === "number")) {
                throw new Error("下書きの保存先を確認できませんでした");
            }
            saved.current = { action, key, files, response: data };
            if (action === "draft") setDraftSaved(true);
            const videoOk =
                action === "main"
                    ? await videoUploadAndConvert({
                          target: "editing",
                          videoFile: videoInput.videoFile,
                          videoSignedUrl: data.videoSignedUrl,
                          itemEditingId,
                      })
                    : await videoUploadAndConvert({
                          target: "draft",
                          videoFile: videoInput.videoFile,
                          videoSignedUrl: data.videoSignedUrl,
                          itemDraftId: data.itemDraftId!,
                      });
            if (!videoOk || !mounted.current) return;
            if (
                !(await thumbnailUpload({
                    thumbnailFile: videoInput.thumbnailFile,
                    thumbnailSignedUrl: data.thumbnailSignedUrl,
                })) ||
                !mounted.current
            )
                return;
            if (
                !(await itemImageUpload({
                    itemImageFiles: itemImages,
                    itemImageSignedUrls: data.itemImageSignedUrls,
                })) ||
                !mounted.current
            )
                return;
            if (
                !(await attributesImageUpload({ attributesValue, signedUrlMap: data.attributesImageSignedUrls })) ||
                !mounted.current
            )
                return;
            toast.success(action === "main" ? "商品データを登録しました" : "下書き保存しました");
            await sleep(1500);
            if (!mounted.current) return;
            window.location.assign(
                action === "draft"
                    ? "/item-list/draft"
                    : page === "edit"
                      ? `/item/confirm/edit/${itemEditingId}`
                      : `/item/confirm/${itemEditingId}`,
            );
            navigating = true;
        } catch (error) {
            if (!mounted.current) return;
            if (error instanceof ApiError)
                toast.error(action === "main" ? "データ作成に失敗しました" : "下書き保存に失敗しました");
            else alert("システムエラーが発生しました。時間をおいて再試行してください");
        } finally {
            if (!navigating) {
                submitting.current = false;
                if (mounted.current) setPending(false);
            }
        }
    };

    return (
        <UploadUI title="商品をアップロード">
            <TopLoader loading={loading} />
            <TopLoader loading={draftLoading} />

            {draftSaved && (
                <p role="status">
                    下書きデータは保存済みです。転送に失敗した場合は下書き保存ボタンから再試行してください。
                </p>
            )}
            <fieldset disabled={busy || draftSaved} inert={busy || draftSaved} className={styles.fields}>
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

                <GenderAge
                    value={genderAgeValue}
                    onChange={setGenderAgeValue}
                    categoryConstraint={categoryConstraint}
                />

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
            </fieldset>
            <div className={styles.formButtonDiv}>
                <button
                    type="button"
                    className={styles.uploadButton}
                    onClick={() => submit("main")}
                    disabled={busy || draftSaved}
                >
                    {loading ? "登録中..." : "出品する"}
                </button>

                {page !== "edit" && (
                    <button
                        type="button"
                        className={styles.draftButton}
                        onClick={() => submit("draft")}
                        disabled={busy}
                    >
                        {draftLoading ? "保存中..." : "下書き保存する"}
                    </button>
                )}
            </div>
        </UploadUI>
    );
};
