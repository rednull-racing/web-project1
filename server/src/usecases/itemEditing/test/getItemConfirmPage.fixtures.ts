import type { ItemEditing } from "../../../models/item_editing.js";

// 単体では検索結果の受渡しのみを扱い、実ModelのJSON化は結合テストで確認する。
export const makeConfirmRow = (id = 123): ItemEditing =>
    ({ id, seller_id: 7, item_id: null, duration: 0, name: null, image_url: [], attributes: {},
        updatedAt: new Date("2026-10-30T00:00:00.000Z") }) as ItemEditing;

export const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};
