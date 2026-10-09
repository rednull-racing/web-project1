import { expect } from "vitest";
import { AppError } from "../../../../src/errors.js";
import type { ItemEditingConfirmBody } from "../../../../src/validators/body/itemEditing.js";

export const makeBody = (): ItemEditingConfirmBody => ({
    videoMeta: { title: "動画タイトル", summary: "動画説明" },
    itemMeta: { name: "商品名", detail: "商品説明" },
    itemImages: [{ name: "既存画像", type: "image/png", uploaded: true }],
    category: { id: "21", name: "入力上のカテゴリ", parent_id: null, level: 1 },
    genderAge: { gender: "unisex", age: "both" },
    brand: { id: "61", name: "ブランド" },
    attributes: {
        allInventory: 1,
        colorVariants: [{ uiId: "red", color: "赤", inventory: 2, sizes: [{ size: "M", inventory: 3 }] }],
        materials: [
            { name: "綿", ratio: 80 },
            { name: "麻", ratio: 20 },
        ],
    },
    condition: { id: "31", name: "新品" },
    shipping: { day: "41", service: "51", place: "13", freeText: "配送備考" },
    price: 300,
});

export const makeItem = () => ({
    id: 11,
    seller_id: 7,
    item_id: 101,
    original_url: "https://media.test/original",
    converted_url: null as string | null,
    thumbnail_url: "https://media.test/thumbnail" as string | null,
    image_url: ["https://media.test/image0", "https://media.test/image1", "https://media.test/image2"],
    attributes: {
        inventory: { initial: 10, current: 4, low_stock_ratio: 0.2 },
        colorVariants: [
            { uiId: "red", image_url: "https://media.test/red" },
            { uiId: "blue", image_url: "https://media.test/blue" },
        ],
    },
    video_status: null as string | null,
    duration: 20,
});

export const expectAppError = async (promise: Promise<unknown>, code: string, statusCode = 400) => {
    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ code, statusCode });
};

export const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};
