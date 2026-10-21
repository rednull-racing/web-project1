import type ItemEditing from "../../../../src/models/item_editing.js";
export const idFields = [
    "category_id",
    "item_condition_id",
    "shipping_day_id",
    "shipping_service_id",
    "shipping_place_id",
    "brand_id",
    "brand_aliases_id",
] as const;
export const makeAttributes = () => ({
    inventory: { initial: 9, current: 2, low_stock_ratio: 0.2 },
    colorVariants: [
        {
            uiId: "red",
            name: "赤",
            image_url: "https://media.test/red",
            inventory: { initial: 5, current: 1, low_stock_ratio: 0.3 },
            sizes: [
                { uiId: "m", name: "M", inventory: { initial: 3, current: 0, low_stock_ratio: 0.5 } },
                { uiId: "l", name: "L", inventory: { initial: 2, current: 1, low_stock_ratio: 0.6 } },
            ],
        },
        { uiId: "blue", name: "青", inventory: { initial: 2, current: 0, low_stock_ratio: 0.4 } },
    ],
    materials: [{ name: "綿", ratio: 100 }],
    body_category: "top",
    lifestyle_category: "casual",
    layer: "middle",
    fit: "regular",
    extra: { values: ["保持", 42] },
});
export const makeEditing = () =>
    ({
        id: 11,
        seller_id: 7,
        name: " ＴｅＳＴ カタカナ ",
        title: " ＶＩＤＥＯ テスト ",
        detail: "説明AB",
        summary: "動画C",
        price: 12340,
        before_price: 15000,
        discount_rate: 20,
        discount_amount: 1000,
        sale_flag: true,
        original_url: "https://media.test/original",
        converted_url: "https://media.test/converted",
        thumbnail_url: "https://media.test/thumbnail",
        first_image_url: "https://media.test/first",
        image_url: ["https://media.test/first", "https://media.test/second"],
        duration: 30,
        video_status: "ready",
        category_id: 21,
        item_condition_id: 22,
        shipping_day_id: 23,
        shipping_service_id: 24,
        shipping_place_id: 25,
        brand_id: 26,
        brand_aliases_id: 27,
        shipping_service_free_text: "配送備考",
        gender_type: "unisex",
        age_type: "both",
        recommend: false,
        attributes: makeAttributes(),
        createdAt: new Date("2020-01-01"),
        updatedAt: new Date("2020-01-02"),
    }) as unknown as InstanceType<typeof ItemEditing>;
export const expectedAttributes = () => {
    const value = makeAttributes();
    value.inventory.current = 9;
    value.colorVariants[0].inventory.current = 5;
    value.colorVariants[1].inventory.current = 2;
    value.colorVariants[0].sizes![0].inventory.current = 3;
    value.colorVariants[0].sizes![1].inventory.current = 2;
    return value;
};
export const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};
export const freezeDeep = (value: unknown): void => {
    if (value && typeof value === "object") {
        Object.freeze(value);
        for (const child of Object.values(value)) freezeDeep(child);
    }
};
export const boundary = <T>(signal: Promise<T>, pending: Promise<unknown>): Promise<T> =>
    Promise.race([
        signal,
        pending.then(() => {
            throw new Error("待機境界に到達する前に対象処理が完了しました");
        }),
    ]);

export const requiredIdFields = [
    "category_id",
    "item_condition_id",
    "shipping_day_id",
    "shipping_service_id",
    "shipping_place_id",
] as const;
export const nullableBrandCases = [
    { brand_id: null },
    { brand_aliases_id: null },
    { brand_id: null, brand_aliases_id: null },
] as const;
