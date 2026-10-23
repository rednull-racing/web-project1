import { expect } from "vitest";
import { AppError } from "../../../errors.js";
import type { CreateItemEditingDraftParams } from "../../../types/serviceType/itemEditing.js";
import type { CreateItemEditingDraftBody } from "../../../validators/body/itemEditing.js";

export type CopyData = CreateItemEditingDraftParams["data"];
export const copyColumns = [
    "name",
    "detail",
    "image_url",
    "price",
    "item_condition_id",
    "first_image_url",
    "gender_type",
    "age_type",
    "recommend",
    "category_id",
    "brand_id",
    "brand_aliases_id",
    "attributes",
    "thumbnail_url",
    "title",
    "summary",
    "duration",
    "original_url",
    "converted_url",
    "video_status",
    "before_price",
    "discount_rate",
    "discount_amount",
    "sale_flag",
    "shipping_day_id",
    "shipping_service_id",
    "shipping_place_id",
    "shipping_service_free_text",
] as const satisfies readonly (keyof CopyData)[];

export const makeBody = (itemDraftId = 11): CreateItemEditingDraftBody => ({ itemDraftId });
export const makeData = (overrides: Partial<CopyData> = {}): CopyData => ({
    status: "normal",
    seller_id: 7,
    name: "下書きの商品名",
    detail: "下書きの説明",
    image_url: ["https://media.test/image-a", "https://media.test/image-b", "https://media.test/image-c"],
    price: 800,
    item_condition_id: 31,
    first_image_url: "https://media.test/first-independent",
    gender_type: "women",
    age_type: "kids",
    recommend: true,
    category_id: 21,
    brand_id: 61,
    brand_aliases_id: 71,
    attributes: {
        inventory: { initial: 10, current: 4, low_stock_ratio: 0.5 },
        colorVariants: [
            {
                uiId: "red",
                color: "赤",
                image_url: "https://media.test/red",
                inventory: { initial: 8, current: 2, low_stock_ratio: 0.3 },
                sizes: [
                    { size: "M", inventory: { initial: 6, current: 1, low_stock_ratio: 0.4 } },
                    { size: "L", inventory: { initial: 2, current: 1, low_stock_ratio: 0.6 } },
                ],
            },
            { uiId: "blue", color: "青", image_url: "https://media.test/blue", sizes: [] },
        ],
        materials: [
            { name: "綿", ratio: 80.5 },
            { name: "麻", ratio: 19.5 },
        ],
        body_category: "top",
        lifestyle_category: "casual",
        layer: "middle",
        fit: "wide",
    },
    thumbnail_url: "https://media.test/thumbnail",
    title: "下書きの動画タイトル",
    summary: "下書きの動画概要",
    duration: 30,
    original_url: "https://media.test/original",
    converted_url: "https://media.test/converted",
    video_status: "converted",
    before_price: 1200,
    discount_rate: 25,
    discount_amount: 400,
    sale_flag: true,
    shipping_day_id: 41,
    shipping_service_id: 51,
    shipping_place_id: 13,
    shipping_service_free_text: "下書きの配送備考",
    ...overrides,
});

export const makeDraft = (overrides: Partial<CopyData> = {}) => ({
    ...makeData(overrides),
    id: 11,
    createdAt: new Date("2020-01-01T00:00:00Z"),
    updatedAt: new Date("2020-01-02T00:00:00Z"),
});

export const nullableData: Partial<CopyData> = {
    name: null,
    detail: null,
    image_url: null,
    price: null,
    item_condition_id: null,
    first_image_url: null,
    recommend: null,
    category_id: null,
    brand_id: null,
    brand_aliases_id: null,
    thumbnail_url: null,
    title: null,
    summary: null,
    duration: null,
    original_url: null,
    converted_url: null,
    video_status: null,
    before_price: null,
    discount_rate: null,
    discount_amount: null,
    shipping_day_id: null,
    shipping_service_id: null,
    shipping_place_id: null,
    shipping_service_free_text: null,
};
export const stringColumns = ["name", "title", "video_status", "shipping_service_free_text"] as const;
export const textColumns = [
    "detail",
    "summary",
    "first_image_url",
    "thumbnail_url",
    "original_url",
    "converted_url",
] as const;
export const copyVariants: { id: string; name: string; values: Partial<CopyData> }[] = [
    { id: "N03", name: "nullable列と空JSON", values: { ...nullableData, attributes: {} } },
    {
        id: "N04",
        name: "空文字・空配列",
        values: {
            name: "",
            detail: "",
            title: "",
            summary: "",
            video_status: "",
            thumbnail_url: "",
            original_url: "",
            converted_url: "",
            first_image_url: "",
            shipping_service_free_text: "",
            image_url: [],
            attributes: { colorVariants: [], materials: [] },
        },
    },
    {
        id: "N05",
        name: "0とfalse",
        values: {
            price: 0,
            before_price: 0,
            discount_rate: 0,
            discount_amount: 0,
            duration: 0,
            recommend: false,
            sale_flag: false,
        },
    },
    { id: "N05", name: "recommendがnull", values: { recommend: null } },
    { id: "N06", name: "任意キーなし", values: { attributes: {} } },
    {
        id: "N06",
        name: "配列内の任意キーなし",
        values: { attributes: { colorVariants: [{ sizes: [] }], materials: [{}] } },
    },
    ...(["men", "women", "unisex"] as const).map((gender_type) => ({
        id: "N07",
        name: `gender=${gender_type}`,
        values: { gender_type },
    })),
    ...(["adult", "kids", "both"] as const).map((age_type) => ({
        id: "N07",
        name: `age=${age_type}`,
        values: { age_type },
    })),
    ...[null, "pending", "failed"].map((video_status) => ({
        id: "N07",
        name: `video_status=${video_status}`,
        values: { video_status },
    })),
    ...stringColumns.flatMap((column) =>
        [0, 254, 255].map((length) => ({
            id: "B01",
            name: `${column}が${length}文字`,
            values: { [column]: "あ".repeat(length) },
        })),
    ),
    ...[null, 0, 1, 10].map((count) => ({
        id: "B02",
        name: `画像=${count}`,
        values: {
            image_url: count === null ? null : Array.from({ length: count }, (_, i) => `https://media.test/${i}`),
        },
    })),
    ...textColumns.flatMap((column) =>
        ["", "日本語の長文".repeat(1000)].map((value) => ({
            id: "B03",
            name: `${column}の${value.length}文字`,
            values: { [column]: value },
        })),
    ),
];

export const invalidIds = [
    { name: "0", value: 0 },
    { name: "負数", value: -1 },
    { name: "小数", value: 1.5 },
    { name: "数字文字列", value: "11" },
    { name: "空文字", value: "" },
    { name: "boolean", value: true },
    { name: "null", value: null },
    { name: "配列", value: [] },
    { name: "object", value: {} },
    { name: "欠落", value: undefined },
];
export const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};
export const expectAppError = async (promise: Promise<unknown>, code = "ITEM_DRAFT_NOT_FOUND", statusCode = 404) => {
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ code, statusCode });
};

// 待合せ先の失敗・早期終了も回収し、通知だけを永久に待たない。
export const waitForGate = async <T>(entered: Promise<T>, pending: Promise<unknown>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            entered,
            pending.then(() => {
                throw new Error("gate到達前に処理が完了しました");
            }),
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject(new Error("gateの通知が期限内に届きませんでした")), 5000);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};
