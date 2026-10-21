import { expect } from "vitest";
import type { Transaction } from "sequelize";
import { AppError } from "../../../../errors.js";
import type ItemEditing from "../../../../models/item_editing.js";
import type { ItemAttributes } from "../../../../types/itemAttributes.js";
import type { CreateItemEditingCopyParams } from "../../../../types/serviceType/itemEditing.js";
import type { ItemWithVideoSaleShipping } from "../../../../types/serviceType/items.js";

export const makeAttributes = (): ItemAttributes => ({
    inventory: { initial: 20, current: 6, low_stock_ratio: 0.15 },
    colorVariants: [
        {
            uiId: "red",
            color: "赤",
            image_url: "https://media.test/red",
            inventory: { initial: 8, current: 1, low_stock_ratio: 0.25 },
            sizes: [
                { size: "M", inventory: { initial: 3, current: 0, low_stock_ratio: 0.1 } },
                { size: "L", inventory: { initial: 5, current: 1, low_stock_ratio: 0.3 } },
            ],
        },
        {
            uiId: "blue",
            color: "青",
            image_url: "https://media.test/blue",
            inventory: { initial: 12, current: 5, low_stock_ratio: 0.4 },
            sizes: [{ size: "S", inventory: { initial: 12, current: 5, low_stock_ratio: 0.35 } }],
        },
    ],
    materials: [
        { name: "綿", ratio: 80.5 },
        { name: "麻", ratio: 19.5 },
        { name: "他", ratio: 0 },
    ],
    body_category: "top",
    lifestyle_category: "casual",
    layer: "middle",
    fit: "regular",
});

// 期待値は初期在庫の明示値から作り、本番の復元処理を再実装しない。
export const expectedAttributes = (): ItemAttributes => ({
    inventory: { initial: 20, current: 20, low_stock_ratio: 0.15 },
    colorVariants: [
        {
            uiId: "red",
            color: "赤",
            image_url: "https://media.test/red",
            inventory: { initial: 8, current: 8, low_stock_ratio: 0.25 },
            sizes: [
                { size: "M", inventory: { initial: 3, current: 3, low_stock_ratio: 0.1 } },
                { size: "L", inventory: { initial: 5, current: 5, low_stock_ratio: 0.3 } },
            ],
        },
        {
            uiId: "blue",
            color: "青",
            image_url: "https://media.test/blue",
            inventory: { initial: 12, current: 12, low_stock_ratio: 0.4 },
            sizes: [{ size: "S", inventory: { initial: 12, current: 12, low_stock_ratio: 0.35 } }],
        },
    ],
    materials: [
        { name: "綿", ratio: 80.5 },
        { name: "麻", ratio: 19.5 },
        { name: "他", ratio: 0 },
    ],
    body_category: "top",
    lifestyle_category: "casual",
    layer: "middle",
    fit: "regular",
});

export const makeItem = () => ({
    id: 101,
    seller_id: 7 as number | null,
    status: "active" as string,
    name: "公開商品" as string | null,
    detail: "商品説明\n日本語" as string | null,
    image_url: ["https://media.test/image0", "https://media.test/image1", "https://media.test/image2"] as
        | string[]
        | null,
    price: 7200 as number | null,
    item_condition_id: 31 as number | null,
    first_image_url: "https://media.test/independent-first" as string | null,
    gender_type: "unisex" as "men" | "women" | "unisex",
    age_type: "both" as "adult" | "kids" | "both",
    recommend: true as boolean | null,
    category_id: 21 as number | null,
    brand_id: 61 as number | null,
    brand_aliases_id: 71 as number | null,
    attributes: makeAttributes(),
    Video: {
        thumbnail_url: "https://media.test/thumbnail" as string | null,
        title: "動画タイトル" as string | null,
        summary: "動画説明" as string | null,
        duration: 42 as number | null,
        original_url: "https://media.test/original" as string | null,
        converted_url: "https://media.test/converted" as string | null,
        status: "ready" as string | null,
    } as
        | {
              thumbnail_url: string | null;
              title: string | null;
              summary: string | null;
              duration: number | null;
              original_url: string | null;
              converted_url: string | null;
              status: string | null;
          }
        | null
        | undefined,
    Sale: { before_price: 10000, discount_rate: 28, discount_amount: 2800, sale_flag: true } as
        | {
              before_price: number | null;
              discount_rate: number | null;
              discount_amount: number | null;
              sale_flag: boolean;
          }
        | null
        | undefined,
    ItemShippingProfile: {
        shipping_day_id: 41,
        shipping_service_id: 51,
        shipping_place_id: 13,
        shipping_service_free_text: "配送備考",
    } as
        | {
              shipping_day_id: number | null;
              shipping_service_id: number | null;
              shipping_place_id: number | null;
              shipping_service_free_text: string | null;
          }
        | null
        | undefined,
    video_id: 201,
    sale_id: 202,
    shipping_id: 203,
    views_count: 999,
    createdAt: new Date("2020-01-01T00:00:00Z"),
    updatedAt: new Date("2020-02-01T00:00:00Z"),
});
export type SourceFixture = ReturnType<typeof makeItem>;

// ORMのインスタンスメソッドを使わない依存境界にだけ型を合わせる。
export const sourceResult = (item: SourceFixture): ItemWithVideoSaleShipping =>
    item as unknown as ItemWithVideoSaleShipping;
export const editingResult = (id = 456): ItemEditing => ({ id }) as ItemEditing;
export const transactionFixture = (): Transaction => ({ LOCK: { UPDATE: "UPDATE" } }) as Transaction;

export const expectedData = (): CreateItemEditingCopyParams["data"] => ({
    seller_id: 7,
    name: "公開商品",
    detail: "商品説明\n日本語",
    image_url: ["https://media.test/image0", "https://media.test/image1", "https://media.test/image2"],
    item_condition_id: 31,
    first_image_url: "https://media.test/independent-first",
    gender_type: "unisex",
    age_type: "both",
    recommend: true,
    category_id: 21,
    brand_id: 61,
    brand_aliases_id: 71,
    attributes: expectedAttributes(),
    thumbnail_url: "https://media.test/thumbnail",
    title: "動画タイトル",
    summary: "動画説明",
    duration: 42,
    original_url: "https://media.test/original",
    converted_url: "https://media.test/converted",
    video_status: "ready",
    before_price: 10000,
    price: 10000,
    discount_rate: null,
    discount_amount: null,
    sale_flag: false,
    shipping_day_id: 41,
    shipping_service_id: 51,
    shipping_place_id: 13,
    shipping_service_free_text: "配送備考",
});
export const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};
export const expectAppError = async (promise: Promise<unknown>, code = "ITEM_NOT_FOUND", statusCode = 404) => {
    const error: unknown = await promise.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code, statusCode });
};
export const freezeDeep = <T>(value: T): T => {
    if (value && typeof value === "object") {
        for (const child of Object.values(value)) freezeDeep(child);
        Object.freeze(value);
    }
    return value;
};
export const nullableItemKeys = [
    "name",
    "detail",
    "image_url",
    "item_condition_id",
    "first_image_url",
    "recommend",
    "category_id",
    "brand_id",
    "brand_aliases_id",
] as const;
export const videoKeys = [
    "thumbnail_url",
    "title",
    "summary",
    "duration",
    "original_url",
    "converted_url",
    "status",
] as const;
export const shippingKeys = [
    "shipping_day_id",
    "shipping_service_id",
    "shipping_place_id",
    "shipping_service_free_text",
] as const;
