import type { ItemEditing } from "../types";

export const createEditing = (overrides: Partial<ItemEditing> = {}): ItemEditing => ({
    id: "101", status: "normal", item_id: 501, seller_id: 7,
    name: "確認用シャツ", title: "動画タイトル", detail: "商品説明", summary: "動画概要",
    price: 12000, before_price: 15000, discount_rate: 20, discount_amount: 3000, sale_flag: false,
    image_url: ["/image-1.png", "/image-2.png", "/image-3.png"], first_image_url: "/image-1.png",
    thumbnail_url: "/thumbnail.png", original_url: "/video.mp4", converted_url: "/video.m3u8", duration: "30",
    gender_type: "men", age_type: "adult", recommend: true,
    updatedAt: new Date("2026-10-30T02:00:00Z"),
    attributes: {
        inventory: { initial: 10, current: 5, low_stock_ratio: 0.2 },
        colorVariants: [{ color: "赤", image_url: "/red.png", inventory: { initial: 10, current: 2, low_stock_ratio: 0.2 }, sizes: [{ size: "M", inventory: { initial: 10, current: 1, low_stock_ratio: 0.2 } }] }, { color: "青", image_url: "/blue.png" }],
        materials: [{ name: "綿", ratio: 60 }, { name: "ポリエステル", ratio: 40 }],
    },
    Category: { id: 21, name: "シャツ", level: 1, allowed_gender: "all", allowed_age: "all", parent_id: null, parent: null, children: [] },
    Brand: null, ItemConditionOption: { id: "1", name: "新品" },
    ShippingServiceOption: { id: "2", name: "宅配便" }, ShippingDayOption: { id: "3", name: "1〜2日" },
    TodouhukenOption: { id: "4", name: "東京都" }, shipping_service_free_text: "自由入力配送",
    ...overrides,
});
