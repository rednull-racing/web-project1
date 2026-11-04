import type { ItemEditing } from "../../../models/item_editing.js";

// 単体では検索結果の受渡しのみを扱い、実ModelのJSON化は結合テストで確認する。
export const makeFormRow = (id = 123): ItemEditing => {
    const row: Pick<ItemEditing, "id" | "seller_id" | "duration" | "name" | "image_url" | "attributes"> = {
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

export const makeFormResult = (id = 123) => ({
    itemEditing: makeFormRow(id),
    category: [{ id: 10, name: "親", level: 1, allowed_gender: "unisex", allowed_age: "both", parent_id: null }],
    allCondition: [{ id: 20, name: "新品" }],
    allDay: [{ id: 30, name: "翌日" }],
    allService: [{ id: 40, name: "配送" }],
    allPlace: [{ id: 50, name: "東京都" }],
    hasShop: true,
});
