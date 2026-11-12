export const base = "http://127.0.0.1:4100/api";
// APIのwrapped配列・数値ID・ISO日時を維持する。
export const row = (id = 101) => ({
    id, name: `検証用シャツ${id}`, price: 12345, title: "動画A",
    first_image_url: "/test-item.jpg", createdAt: "2026-11-11T23:00:00.000Z",
});
export const response = () => ({ itemDraftList: [{ itemDraft: row() }, { itemDraft: row(102) }], totalPages: 3 });
export const wireResponse = (nullable = false) => ({
    itemDraftList: [{ itemDraft: { ...row(), id: 101,
        name: nullable ? null : row().name, title: nullable ? null : row().title,
        first_image_url: nullable ? null : row().first_image_url,
        price: nullable ? null : row().price,
    } }], totalPages: 1,
});
export const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
};
