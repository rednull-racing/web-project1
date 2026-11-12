export const base = "http://127.0.0.1:4100/api";
export const row = (id = 101) => ({
    id,
    name: `検証用シャツ${id}`,
    price: 12345,
    title: "動画A",
    first_image_url: "/test-item.jpg",
    createdAt: "2026-11-11T23:00:00.000Z",
});
// 実API同形。レスポンスのwrapperと日時文字列を変換しない。
export const response = () => ({ itemTrashList: [{ itemTrash: row() }], totalPages: 3 });
export const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
};
