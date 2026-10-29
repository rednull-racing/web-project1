import type { ItemDraft } from "@/app/item/draft/types";

export const createDraft = (overrides: Partial<ItemDraft> = {}): ItemDraft => ({
    id: 11,
    seller_id: 7,
    name: "下書きシャツ",
    title: "動画タイトル",
    detail: "商品説明の本文",
    summary: "動画概要の本文",
    price: 800,
    image_url: ["/test-image-1.png", "/test-image-2.png", "/test-image-3.png"],
    first_image_url: "/test-first.png",
    thumbnail_url: "/test-thumb.png",
    original_url: "/test-video.mp4",
    converted_url: "/test-video.m3u8",
    duration: 30,
    gender_type: "men",
    age_type: "adult",
    recommend: true,
    before_price: 1200,
    discount_rate: 25,
    discount_amount: 400,
    sale_flag: true,
    attributes: {
        inventory: { initial: 10, current: 4, low_stock_ratio: 0.2 },
        colorVariants: [
            {
                uiId: "red",
                color: "赤",
                image_url: "/test-red.png",
                inventory: { initial: 10, current: 1, low_stock_ratio: 0.2 },
                sizes: [
                    { size: "M", inventory: { initial: 10, current: 0, low_stock_ratio: 0.2 } },
                    { size: "L", inventory: { initial: 10, current: 3, low_stock_ratio: 0.2 } },
                ],
            },
            {
                uiId: "blue",
                color: "青",
                image_url: "/test-blue.png",
                inventory: { initial: 10, current: 0, low_stock_ratio: 0.2 },
            },
        ],
        materials: [
            { name: "綿", ratio: 60 },
            { name: "ポリエステル", ratio: 40 },
        ],
    },
    Brand: null,
    Category: {
        id: 21,
        name: "シャツ",
        parent: null,
        children: [],
    },
    ItemConditionOption: { id: 1, name: "新品" },
    ShippingServiceOption: { id: 2, name: "宅配便" },
    ShippingDayOption: { id: 3, name: "1〜2日" },
    TodouhukenOption: { id: 4, name: "東京都" },
    shipping_service_free_text: "指定配送",
    updatedAt: "2026-10-28T02:00:00Z",
    ...overrides,
});

export const createEmptyDraft = (): ItemDraft =>
    createDraft({
        name: null,
        title: null,
        detail: null,
        summary: null,
        price: null,
        image_url: null,
        first_image_url: null,
        thumbnail_url: null,
        original_url: null,
        converted_url: null,
        duration: null,
        recommend: null,
        before_price: null,
        discount_rate: null,
        discount_amount: null,
        sale_flag: false,
        attributes: {},
        Category: null,
        ItemConditionOption: null,
        ShippingServiceOption: null,
        ShippingDayOption: null,
        TodouhukenOption: null,
        shipping_service_free_text: null,
    });

export const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

export const deepFreeze = <T>(value: T): T => {
    if (typeof value === "object" && value !== null) {
        Object.values(value).forEach(deepFreeze);
        Object.freeze(value);
    }
    return value;
};
