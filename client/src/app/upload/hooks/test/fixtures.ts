import type { UploadParams } from "../useUpload";
export const params = (): UploadParams => ({
    videoInput: {
        videoFile: null,
        thumbnailFile: null,
        thumbnailPreview: "/thumb.jpg",
        title: "着用動画",
        summary: "概要",
        videoUploaded: true,
        thumbnailUploaded: true,
    },
    itemImages: [{ id: "img", file: null, preview: "https://storage.test/old.jpg", uploaded: true }],
    itemNameDetail: { name: "綿シャツ", detail: "商品説明" },
    categoryValue: { id: "10", name: "シャツ", parent_id: 1, level: 2 },
    genderAgeValue: { gender_type: "unisex", age_type: "adult" },
    brandValue: { id: "20", name: "ブランド" },
    attributesValue: {
        all_inventory: 2,
        colorVariants: [
            {
                _uiId: "red",
                color: "赤",
                inventory: 2,
                image: null,
                image_uploaded: true,
                sizes: [{ size: "M", inventory: 2 }],
            },
        ],
    },
    materialValue: {
        materials: [
            { name: "綿", ratio: 60 },
            { name: "麻", ratio: 40 },
        ],
    },
    conditionValue: { id: "1", name: "新品" },
    shippingValue: {
        day_id: "2",
        day_name: "2日",
        service_id: "3",
        service_name: "宅配",
        place_id: "4",
        place_name: "東京",
        free_text: null,
    },
    priceValue: { price: 1000 },
    resolveAttributesImage: () => null,
});
