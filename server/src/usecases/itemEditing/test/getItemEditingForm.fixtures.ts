import type { ItemEditing } from "../../../models/item_editing.js";

// 単体では検索結果の受渡しのみを扱い、実ModelのJSON化は結合テストで確認する。
export const makeFormRow = (id = 123): ItemEditing => {
    const row: Pick<
        ItemEditing,
        "id" | "seller_id" | "duration" | "name" | "image_url" | "attributes"
    > = {
        id,
        seller_id: 7,
        duration: 0,
        name: null,
        image_url: [],
        attributes: {},
    };
    return row as ItemEditing;
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
