import type { Transaction } from "sequelize";
import { expect } from "vitest";
import { AppError } from "../../../../src/errors.js";
import type { getMyItemDraft } from "../../../../src/services/itemDraft/query.js";

export const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};
export const waitForGate = async <T>(signal: Promise<T>, pending: Promise<unknown>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            signal,
            pending.then(() => {
                throw new Error("gate到達前に処理が完了しました");
            }),
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject(new Error("gate待機期限超過")), 5000);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};
export const expectNotFound = async (pending: Promise<unknown>) => {
    await expect(pending).rejects.toBeInstanceOf(AppError);
    await expect(pending).rejects.toMatchObject({ code: "ITEM_DRAFT_NOT_FOUND", statusCode: 404 });
};
// DB非接続テストが必要とするインスタンス・transactionの境界だけを用意する。
export const makeDraft = (id = 101) => ({ id }) as NonNullable<Awaited<ReturnType<typeof getMyItemDraft>>>;
export const makeTransaction = (id = "t1") => ({ id, LOCK: { UPDATE: "UPDATE" } }) as unknown as Transaction;
export const invalidIds = [
    { id: "V02", value: "0" },
    { id: "V02", value: "-1" },
    { id: "V02", value: "2147483648" },
    { id: "V02", value: "9007199254740992" },
    ...["0.5", "1.5", "2147483646.5", "NaN", "Infinity", "-Infinity", "abc"].map((value) => ({ id: "V03", value })),
    ...[undefined, null, "", "   "].map((value) => ({ id: "V04", value })),
    ...["1 OR 1=1", "1;DROP TABLE item_draft", "<script>1</script>", "1/2", "1,2"].map((value) => ({
        id: "V05",
        value,
    })),
];
export const acceptedSpellings = [
    ["01", 1],
    ["+1", 1],
    ["1.0", 1],
    ["1e2", 100],
    ["0x10", 16],
    [" 1 ", 1],
    ["1.0000000000000000001", 1],
] as const;
export const draftColumns = [
    "id",
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
];
