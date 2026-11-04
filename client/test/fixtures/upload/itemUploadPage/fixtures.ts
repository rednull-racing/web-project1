import type { ComponentProps } from "react";
import type { Form } from "@/app/upload/form";

export function formProps(page: "normal" | "edit" = "normal"): ComponentProps<typeof Form> {
    const category = {
        id: "10",
        name: "トップス",
        level: 1,
        parent_id: 0,
        allowed_gender: "unisex",
        allowed_age: "both",
        body_category: "top",
        lifestyle_category: "casual",
        layer: "middle",
    } as const;
    return {
        itemEditingId: "123",
        page,
        category: [category],
        hasShop: true,
        allCondition: [{ id: "1", name: "未使用" }],
        allDay: [{ id: "2", name: "1〜2日" }],
        allService: [{ id: "3", name: "宅配便" }],
        allPlace: [{ id: "4", name: "東京都" }],
        itemEditing: {
            id: "123",
            status: page === "normal" ? "normal" : "edit",
            seller_id: 7,
            name: "綿シャツ",
            detail: "商品の説明",
            price: 1000,
            before_price: 1000,
            image_url: ["https://media.test/item.jpg"],
            first_image_url: "https://media.test/item.jpg",
            gender_type: "unisex",
            age_type: "both",
            Category: category,
            Brand: null,
            ItemConditionOption: { id: "1", name: "未使用" },
            ShippingDayOption: { id: "2", name: "1〜2日" },
            ShippingServiceOption: { id: "3", name: "宅配便" },
            TodouhukenOption: { id: "4", name: "東京都" },
            shipping_service_free_text: "壊れ物注意",
            thumbnail_url: "https://media.test/thumb.jpg",
            title: "着用動画",
            summary: "動画の説明",
            duration: 10,
            original_url: "https://media.test/original.mp4",
            converted_url: "https://media.test/video.m3u8",
            attributes: {
                inventory: { initial: 2, current: 2, low_stock_ratio: 0.1 },
                colorVariants: ["赤", "青"].map((color, i) => ({
                    uiId: `color-${i}`,
                    color,
                    image_url: `https://media.test/color-${i}.jpg`,
                    inventory: { initial: 1, current: 1, low_stock_ratio: 0.1 },
                    sizes: [{ size: "M", inventory: { initial: 1, current: 1, low_stock_ratio: 0.1 } }],
                })),
                materials: [
                    { name: "綿", ratio: 60 },
                    { name: "麻", ratio: 40 },
                ],
            },
        },
    };
}
export const emptySigned = () => ({
    videoSignedUrl: null,
    thumbnailSignedUrl: null,
    itemImageSignedUrls: [],
    attributesImageSignedUrls: {},
    itemDraftId: 456,
});
export function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}
