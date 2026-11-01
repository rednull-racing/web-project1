import type { ItemEditing } from "../../../../src/app/item/confirm/types";

// HTTP境界の実JSON。フロント型のDate・文字列IDとの違いを型アサーションで隠さない。
export type BrowserEditing = Omit<
    ItemEditing,
    "id" | "updatedAt" | "ItemConditionOption" | "ShippingDayOption" | "ShippingServiceOption" | "TodouhukenOption"
> & {
    id: number;
    updatedAt: string;
    ItemConditionOption: { id: number; name: string } | null;
    ShippingDayOption: { id: number; name: string } | null;
    ShippingServiceOption: { id: number; name: string } | null;
    TodouhukenOption: { id: number; name: string } | null;
};
export const browserEditing = (overrides: Partial<BrowserEditing> = {}): BrowserEditing => ({
    id: 101,
    status: "normal",
    item_id: 501,
    seller_id: 7,
    name: "確認用シャツ",
    detail: "商品の説明です。".repeat(80),
    summary: "動画の概要です。".repeat(80),
    price: 12000,
    before_price: 15000,
    discount_rate: 20,
    discount_amount: 3000,
    sale_flag: true,
    image_url: ["/no-image(1x1).png", "/no-image(16x9).png", "/no-image(1x1).png"],
    first_image_url: "/no-image(1x1).png",
    thumbnail_url: "/no-image(16x9).png",
    original_url: "",
    converted_url: null,
    duration: null,
    title: "確認用動画タイトル",
    gender_type: "men",
    age_type: "adult",
    recommend: true,
    attributes: {
        inventory: { initial: 10, current: 5, low_stock_ratio: 0.2 },
        colorVariants: [
            {
                color: "赤",
                image_url: "/no-image(1x1).png",
                inventory: { initial: 10, current: 2, low_stock_ratio: 0.2 },
                sizes: [{ size: "M", inventory: { initial: 10, current: 1, low_stock_ratio: 0.2 } }],
            },
            {
                color: "青",
                image_url: "/no-image(1x1).png",
                inventory: { initial: 10, current: 0, low_stock_ratio: 0.2 },
            },
        ],
        materials: [
            { name: "綿", ratio: 60 },
            { name: "ポリエステル", ratio: 40 },
        ],
    },
    updatedAt: "2026-10-30T01:00:00Z",
    ItemConditionOption: { id: 1, name: "新品" },
    ShippingDayOption: { id: 2, name: "翌日" },
    ShippingServiceOption: { id: 3, name: "宅配便" },
    TodouhukenOption: { id: 4, name: "東京都" },
    shipping_service_free_text: "自由記述の配送方法",
    Category: {
        id: 5,
        parent_id: null,
        level: 1,
        allowed_gender: "all",
        allowed_age: "all",
        name: "シャツ",
        parent: null,
        children: [],
    },
    Brand: null,
    ...overrides,
});
