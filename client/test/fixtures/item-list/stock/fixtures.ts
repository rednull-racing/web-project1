import type { Item } from "@/app/item-list/types";
export const base = "http://127.0.0.1:4100/api";
export const row = (patch: Partial<Item> = {}): Item => ({
    id: 101, name: "出品シャツ", price: "1200", status: "active",
    gender_type: "men", age_type: "adult", first_image_url: null,
    attributes: { inventory: { initial: 2000, current: 1234, low_stock_ratio: 0.2 } }, uploaded_at: "2026-11-13T00:00:00.000Z", Video: { title: "紹介動画" }, Sale: null,
    ...patch,
});
export const response = () => ({ itemList: [{ item: row() }], totalPages: 2 });
export const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
};
