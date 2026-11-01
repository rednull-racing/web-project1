import type { ItemEditing } from "@/app/item/confirm/types";

export const createConfirm = (overrides: Partial<ItemEditing> = {}): ItemEditing => ({
    id: "101",
    status: "normal",
    item_id: 501,
    seller_id: 7,
    name: "確認用シャツ",
    detail: "商品説明の本文",
    title: "確認用動画",
    summary: "動画概要の本文",
    price: 12000,
    before_price: 15000,
    discount_rate: null,
    discount_amount: null,
    sale_flag: false,
    image_url: ["/test-image-1.png", "/test-image-2.png", "/test-image-3.png"],
    first_image_url: "/test-first.png",
    thumbnail_url: "/test-thumb.png",
    original_url: "/test-video.mp4",
    converted_url: null,
    duration: "30",
    gender_type: "men",
    age_type: "adult",
    recommend: true,
    attributes: {
        inventory: { initial: 10, current: 5, low_stock_ratio: 0.2 },
        colorVariants: [
            {
                uiId: "red",
                color: "赤",
                image_url: "/red.png",
                inventory: { initial: 10, current: 2, low_stock_ratio: 0.2 },
                sizes: [
                    { size: "M", inventory: { initial: 10, current: 0, low_stock_ratio: 0.2 } },
                    { size: "L", inventory: { initial: 10, current: 5, low_stock_ratio: 0.2 } },
                ],
            },
            {
                uiId: "blue",
                color: "青",
                image_url: "/blue.png",
                inventory: { initial: 10, current: 0, low_stock_ratio: 0.2 },
            },
        ],
        materials: [
            { name: "綿", ratio: 60 },
            { name: "ポリエステル", ratio: 40 },
        ],
    },
    Category: {
        id: 21,
        parent_id: null,
        name: "シャツ分類",
        level: 1,
        allowed_gender: "both",
        allowed_age: "both",
        parent: null,
        children: [],
    },
    Brand: { id: "1", name: "確認ブランド" },
    ItemConditionOption: { id: "1", name: "新品" },
    ShippingDayOption: { id: "2", name: "1〜2日" },
    ShippingServiceOption: { id: "3", name: "宅配便" },
    TodouhukenOption: { id: "4", name: "東京都" },
    shipping_service_free_text: "未使用の自由入力",
    updatedAt: new Date("2026-10-30T01:00:00Z"),
    ...overrides,
});

export const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
};
