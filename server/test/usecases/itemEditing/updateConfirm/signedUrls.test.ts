import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, makeBody, makeItem } from "./fixtures.js";
const mocks = vi.hoisted(() => ({
    generateSignedUrl: vi.fn(),
    createVideoPresignedPost: vi.fn(),
    randomUUID: vi.fn(),
}));
vi.mock("node:crypto", () => ({ randomUUID: mocks.randomUUID }));
vi.mock("../../../../src/infra/aws/s3.js", () => ({ publicS3Domain: "https://media.test" }));
vi.mock("../../../../src/utils/s3/index.js", () => mocks);
import { updateItemEditingConfirmBodySchema as schema } from "../../../../src/validators/body/itemEditing.js";
import { buildSignedUrls } from "../../../../src/usecases/shared/buildSignedUrls.js";

let body: ReturnType<typeof makeBody>;
let item: ReturnType<typeof makeItem>;
const upload = () => ({ name: "new.png", type: "image/png", uploaded: false });
const key = (prefix: string, suffix = "") => `${prefix}/7/11${suffix}_1000_request-a`;
const url = (prefix: string, suffix = "") => `https://media.test/${key(prefix, suffix)}`;
const run = () =>
    buildSignedUrls({
        itemEditingId: 11,
        userId: 7,
        body,
        itemEditing: item as unknown as Parameters<typeof buildSignedUrls>[0]["itemEditing"],
    });

beforeEach(() => {
    vi.resetAllMocks();
    mocks.randomUUID.mockReturnValue("request-a");
    body = makeBody();
    item = makeItem();
    vi.spyOn(Date, "now").mockReturnValue(1000);
    mocks.generateSignedUrl.mockImplementation(async ({ key }: { key: string }) => `signed:${key}`);
    mocks.createVideoPresignedPost.mockResolvedValue({ url: "post-url", fields: { key: "post-key" } });
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe("P1: 動画・サムネイルの新規署名と再利用", () => {
    it("S01 S03: 変換済み動画があっても新規動画の署名と公開URLを生成する", async () => {
        item.converted_url = "converted";
        body.video = { name: "new.mp4", type: "video/mp4", uploaded: false };
        const result = await run();
        expect(mocks.createVideoPresignedPost).toHaveBeenCalledExactlyOnceWith({
            key: key("video/original"),
            contentType: "video/mp4",
            contentLengthRange: 500 * 1024 * 1024,
        });
        expect(result.videoSignedUrl).toEqual({ url: "post-url", fields: { key: "post-key" } });
        expect(result.videoUrl).toBe(url("video/original"));
        expect(item.converted_url).toBe("converted");
    });
    it.each([
        undefined,
        { name: "old", type: "video/mp4", uploaded: true },
        { name: "", type: "video/mp4", uploaded: false },
        { type: "video/mp4", uploaded: false },
        { name: "new", type: "", uploaded: false },
        { name: "new", uploaded: false },
    ])("S02: 動画条件%jでは署名せず変換済みURLを優先する", async (video) => {
        body.video = video;
        item.converted_url = "converted";
        const result = await run();
        expect(result.videoSignedUrl).toBeNull();
        expect(result.videoUrl).toBe("converted");
        expect(mocks.createVideoPresignedPost).not.toHaveBeenCalled();
    });
    it.each([
        [null, "original", "original"],
        [null, null, null],
        ["", "original", ""],
        [null, "", ""],
    ])("S02: converted=%s/original=%sなら%sを返す", async (converted, original, expected) => {
        item.converted_url = converted;
        Object.assign(item, { original_url: original });
        expect((await run()).videoUrl).toBe(expected);
    });
    it("S04: 新規サムネイルは指定キー・MIMEで署名する", async () => {
        body.thumbnail = upload();
        const result = await run();
        expect(mocks.generateSignedUrl).toHaveBeenCalledExactlyOnceWith({
            key: key("thumbnail"),
            contentType: "image/png",
        });
        expect(result.thumbnailSignedUrl).toBe(`signed:${key("thumbnail")}`);
        expect(result.thumbnailUrl).toBe(url("thumbnail"));
    });
    it.each([
        undefined,
        { ...upload(), uploaded: true },
        { ...upload(), name: "" },
        { uploaded: false, type: "image/png" },
        { ...upload(), type: "" },
        { name: "new", uploaded: false },
    ])("S04: サムネイル条件%jでは既存URLを利用する", async (thumbnail) => {
        body.thumbnail = thumbnail;
        const result = await run();
        expect(result.thumbnailUrl).toBe(item.thumbnail_url);
        expect(result.thumbnailSignedUrl).toBeNull();
        expect(mocks.generateSignedUrl).not.toHaveBeenCalled();
    });
    it("S04 E03: 新規指定と既存サムネイルがなければnullを返す", async () => {
        item.thumbnail_url = null;
        expect((await run()).thumbnailUrl).toBeNull();
    });
    it("S15: 動画署名undefinedでも新規公開URLは組み立てる", async () => {
        body.video = { name: "new", type: "video/mp4", uploaded: false };
        mocks.createVideoPresignedPost.mockResolvedValue(undefined);
        const result = await run();
        expect(result.videoSignedUrl).toBeNull();
        expect(result.videoUrl).toBe(url("video/original"));
    });
    it("ST05: サムネイルだけ差し替え、動画と商品画像は引き継ぐ", async () => {
        item.converted_url = "converted";
        body.thumbnail = upload();
        const result = await run();
        expect(result).toMatchObject({
            videoUrl: "converted",
            videoSignedUrl: null,
            thumbnailUrl: url("thumbnail"),
            finalImageUrls: [item.image_url[0]],
            itemImageSignedUrls: [],
        });
    });
});

describe("P1: 商品画像・属性画像の対応", () => {
    it("AF-S03 S05: 新規と既存を交互に指定して確定画像の入力順を維持する", async () => {
        body.itemImages = [upload(), { ...upload(), uploaded: true }, upload()];
        const result = await run();
        expect(result.finalImageUrls).toEqual([url("item-image", "_0"), item.image_url[1], url("item-image", "_2")]);
        expect(result.itemImageSignedUrls).toEqual([
            { index: 0, url: `signed:${key("item-image", "_0")}` },
            { index: 2, url: `signed:${key("item-image", "_2")}` },
        ]);
        expect(mocks.generateSignedUrl).toHaveBeenCalledTimes(2);
    });
    it.each([[], null])("S06: 既存image_url=%jなら入力nameをURLとして採用しない", async (images) => {
        Object.assign(item, { image_url: images });
        body.itemImages[0].name = "https://untrusted.test/image";
        expect((await run()).finalImageUrls).toEqual([]);
        expect(mocks.generateSignedUrl).not.toHaveBeenCalled();
    });
    it("S06: 範囲外の既存画像indexは確定配列に含めない", async () => {
        body.itemImages = Array.from({ length: 4 }, () => ({ ...upload(), uploaded: true }));
        expect((await run()).finalImageUrls).toEqual(item.image_url);
    });
    it("S07: 商品画像の空nameは署名を妨げない", async () => {
        body.itemImages = [{ ...upload(), name: "" }];
        expect((await run()).finalImageUrls).toEqual([url("item-image", "_0")]);
        expect(mocks.generateSignedUrl).toHaveBeenCalledOnce();
    });
    it.each([null, ""])("S08 O01: 商品画像type=%sなら署名せず空の確定配列になる", async (type) => {
        body.itemImages = [{ ...upload(), type }];
        const result = await run();
        expect(result.itemImageSignedUrls).toEqual([]);
        expect(result.finalImageUrls).toEqual([]);
        expect(mocks.generateSignedUrl).not.toHaveBeenCalled();
    });
    it("S09: 新しい色画像をuiIdで署名辞書と確定URLへ対応付ける", async () => {
        body.attributes.colorVariants[0].image = upload();
        const result = await run();
        expect(mocks.generateSignedUrl).toHaveBeenCalledExactlyOnceWith({
            key: key("attributes", "_red"),
            contentType: "image/png",
        });
        expect(result.attributesImageSignedUrls).toEqual({ red: `signed:${key("attributes", "_red")}` });
        expect(result.finalAttributesImageUrls).toEqual({ red: url("attributes", "_red") });
    });
    it.each([undefined, { ...upload(), uploaded: true }])(
        "S10: 色画像%jは配列を並べ替えてもuiIdで再利用する",
        async (image) => {
            body.attributes.colorVariants = ["blue", "missing", "red"].map((uiId) => ({
                uiId,
                inventory: 1,
                sizes: [],
                image,
            }));
            const result = await run();
            expect(result.finalAttributesImageUrls).toEqual({
                blue: "https://media.test/blue",
                red: "https://media.test/red",
            });
            expect(result.attributesImageSignedUrls).toEqual({});
        },
    );
    it.each([
        { ...upload(), name: "" },
        { name: "new", uploaded: false },
        { ...upload(), type: "" },
    ])("S11: 不完全な新規色画像%jでは既存画像へfallbackしない", async (image) => {
        body.attributes.colorVariants[0].image = image;
        const result = await run();
        expect(result.finalAttributesImageUrls).toEqual({});
        expect(result.attributesImageSignedUrls).toEqual({});
        expect(mocks.generateSignedUrl).not.toHaveBeenCalled();
    });
    it("S12: 色削除とuiId変更は旧画像を確定辞書から除く", async () => {
        body.attributes.colorVariants[0].uiId = "new-id";
        expect((await run()).finalAttributesImageUrls).toEqual({});
        body.attributes.colorVariants = [];
        expect((await run()).finalAttributesImageUrls).toEqual({});
        expect(item.attributes.colorVariants).toHaveLength(2);
    });
    it.each([null, {}, { colorVariants: null }])(
        "S10: 既存属性%jがなくても新しい色に画像を付けない",
        async (attributes) => {
            Object.assign(item, { attributes });
            expect((await run()).finalAttributesImageUrls).toEqual({});
        },
    );
});

describe("P2: 完了順を制御した観測・重複実行", () => {
    it.each([
        ["AF-S01", [0, 1, 2], [0, 1, 2]],
        ["AF-S01", [0, 1, 2], [2, 1, 0]],
        ["AF-S01", [0, 1, 2], [1, 0, 2]],
        ["AF-S02", [1], [1]],
        ["AF-S02", [0, 2], [2, 0]],
        ["AF-S02", [1, 3], [3, 1]],
    ] as const)("%s S13 P06 O03: 新規index=%j・完了順=%jでも署名を全件返す", async (_id, targetIndices, order) => {
        const targets: readonly number[] = targetIndices;
        const count = Math.max(...targets) + 1;
        item.image_url = Array.from({ length: count }, (_, i) => `old-${i}`);
        body.itemImages = Array.from({ length: count }, (_, i) => ({ ...upload(), uploaded: !targets.includes(i) }));
        const gates = new Map(targets.map((index) => [index, deferred<string>()]));
        mocks.generateSignedUrl.mockImplementation(
            ({ key: k }: { key: string }) => gates.get(Number(k.split("_")[1]))!.promise,
        );
        const pending = run();
        expect(mocks.generateSignedUrl).toHaveBeenCalledTimes(targets.length);
        for (const index of order) {
            gates.get(index)!.resolve(`signed-${index}`);
            await Promise.resolve();
        }
        const result = await pending;
        expect(result.finalImageUrls).toEqual(
            Array.from({ length: count }, (_, i) => (targets.includes(i) ? url("item-image", `_${i}`) : `old-${i}`)),
        );
        expect(result.itemImageSignedUrls).toEqual(targets.map((index) => ({ index, url: `signed-${index}` })));
        expect(new Set(result.itemImageSignedUrls.map((v) => v.index)).size).toBe(targets.length);
    });
    it("S14: 色画像を逆順に完了しても一意uiIdの対応を維持する", async () => {
        body.attributes.colorVariants = ["red", "blue"].map((uiId) => ({
            uiId,
            inventory: 1,
            sizes: [],
            image: upload(),
        }));
        const red = deferred<string>(),
            blue = deferred<string>(),
            started = deferred<void>();
        let calls = 0;
        mocks.generateSignedUrl.mockImplementation(({ key: k }: { key: string }) => {
            if (++calls === 2) started.resolve();
            return k.includes("red") ? red.promise : blue.promise;
        });
        const pending = run();
        await started.promise;
        blue.resolve("signed-blue");
        await Promise.resolve();
        red.resolve("signed-red");
        const result = await pending;
        expect(result.attributesImageSignedUrls).toEqual({ blue: "signed-blue", red: "signed-red" });
        expect(result.finalAttributesImageUrls).toEqual({
            red: url("attributes", "_red"),
            blue: url("attributes", "_blue"),
        });
    });
    it("AF-K04 Q02: 時刻を進めて再実行すると新規アップロードURLが変わる", async () => {
        body.video = { name: "video", type: "video/mp4", uploaded: false };
        body.thumbnail = upload();
        body.itemImages = [upload()];
        body.attributes.colorVariants[0].image = upload();
        const first = await run();
        vi.mocked(Date.now).mockReturnValue(1001);
        const second = await run();
        expect(first.videoUrl).not.toBe(second.videoUrl);
        expect(first.thumbnailUrl).not.toBe(second.thumbnailUrl);
        expect(first.finalImageUrls).not.toEqual(second.finalImageUrls);
        expect(first.finalAttributesImageUrls).not.toEqual(second.finalAttributesImageUrls);
        expect(mocks.createVideoPresignedPost).toHaveBeenCalledTimes(2);
        expect(mocks.generateSignedUrl).toHaveBeenCalledTimes(6);
    });
    it("AF-K01 Q04 O04: 同一ミリ秒でもrequestIdが異なれば全メディアのキーが分かれる", async () => {
        body.video = { name: "video", type: "video/mp4", uploaded: false };
        body.thumbnail = upload();
        body.itemImages = [upload()];
        body.attributes.colorVariants[0].image = upload();
        mocks.randomUUID.mockReturnValueOnce("request-a").mockReturnValueOnce("request-b");
        const first = await run(),
            second = await run();
        expect(Date.now()).toBe(1000);
        expect(mocks.randomUUID).toHaveBeenCalledTimes(2);
        const firstUrls = [
            first.videoUrl,
            first.thumbnailUrl,
            ...first.finalImageUrls,
            first.finalAttributesImageUrls.red,
        ];
        const secondUrls = [
            second.videoUrl,
            second.thumbnailUrl,
            ...second.finalImageUrls,
            second.finalAttributesImageUrls.red,
        ];
        firstUrls.forEach((value, index) => {
            expect(value).toMatch(/_1000_request-a$/);
            expect(secondUrls[index]).toBe(value?.replace("request-a", "request-b"));
        });
        expect(mocks.createVideoPresignedPost).toHaveBeenCalledTimes(2);
        expect(mocks.generateSignedUrl).toHaveBeenCalledTimes(6);
    });
});

describe("E11: 各署名処理のreject", () => {
    it.each(["video", "thumbnail", "item", "attribute"])("%sの例外を同一オブジェクトで伝播する", async (target) => {
        const error = new Error(target);
        if (target === "video") {
            body.video = { name: "v", type: "video/mp4", uploaded: false };
            mocks.createVideoPresignedPost.mockRejectedValue(error);
        } else {
            if (target === "thumbnail") body.thumbnail = upload();
            if (target === "item") body.itemImages = [upload()];
            if (target === "attribute") body.attributes.colorVariants[0].image = upload();
            mocks.generateSignedUrl.mockRejectedValue(error);
        }
        await expect(run()).rejects.toBe(error);
    });
});

describe("F1/F4: 境界とキー対応", () => {
    it.each([0, 1, 10])("AF-S04 S08 V10: 新規署名%s件と確定画像の件数・対応を保持する", async (count) => {
        if (count > 0) body.itemImages = Array.from({ length: count }, upload);
        const result = await run();
        expect(mocks.generateSignedUrl).toHaveBeenCalledTimes(count);
        expect(result.itemImageSignedUrls).toEqual(
            Array.from({ length: count }, (_, index) => ({ index, url: `signed:${key("item-image", `_${index}`)}` })),
        );
        expect(result.finalImageUrls).toEqual(
            count === 0
                ? [item.image_url[0]]
                : Array.from({ length: count }, (_, index) => url("item-image", `_${index}`)),
        );
    });
    it("AF-K02: 1回のrequestIdを全メディアで使い署名keyと公開URLを一致させる", async () => {
        body.video = { name: "video", type: "video/mp4", uploaded: false };
        body.thumbnail = upload();
        body.itemImages = [{ ...upload(), uploaded: true }, upload()];
        body.attributes.colorVariants[0].image = upload();
        const result = await run();
        expect(mocks.randomUUID).toHaveBeenCalledExactlyOnceWith();
        expect(mocks.createVideoPresignedPost).toHaveBeenCalledExactlyOnceWith({
            key: key("video/original"),
            contentType: "video/mp4",
            contentLengthRange: 500 * 1024 * 1024,
        });
        expect(mocks.generateSignedUrl.mock.calls).toEqual([
            [{ key: key("thumbnail"), contentType: "image/png" }],
            [{ key: key("item-image", "_1"), contentType: "image/png" }],
            [{ key: key("attributes", "_red"), contentType: "image/png" }],
        ]);
        expect(result).toMatchObject({
            videoUrl: url("video/original"),
            thumbnailUrl: url("thumbnail"),
            finalImageUrls: [item.image_url[0], url("item-image", "_1")],
            finalAttributesImageUrls: { red: url("attributes", "_red") },
            itemImageSignedUrls: [{ index: 1, url: `signed:${key("item-image", "_1")}` }],
        });
        expect(result.thumbnailSignedUrl).toBe(`signed:${key("thumbnail")}`);
        expect(result.attributesImageSignedUrls).toEqual({ red: `signed:${key("attributes", "_red")}` });
    });
    it("AF-K03: 全メディアを既存利用するとURLを保持して署名を発行しない", async () => {
        body.video = { uploaded: true };
        body.thumbnail = { uploaded: true };
        body.attributes.colorVariants[0].image = { ...upload(), uploaded: true };
        const result = await run();
        expect(result).toEqual({
            videoSignedUrl: null,
            videoUrl: item.original_url,
            thumbnailSignedUrl: null,
            thumbnailUrl: item.thumbnail_url,
            itemImageSignedUrls: [],
            finalImageUrls: [item.image_url[0]],
            attributesImageSignedUrls: {},
            finalAttributesImageUrls: { red: "https://media.test/red" },
        });
        expect(mocks.createVideoPresignedPost).not.toHaveBeenCalled();
        expect(mocks.generateSignedUrl).not.toHaveBeenCalled();
    });
    it("AF-K04: 同時開始した別requestIdの署名を逆順完了しても呼出し間で混ざらない", async () => {
        body.itemImages = [upload()];
        mocks.randomUUID.mockReturnValueOnce("request-a").mockReturnValueOnce("request-b");
        const first = deferred<string>(),
            second = deferred<string>();
        mocks.generateSignedUrl
            .mockImplementationOnce(() => first.promise)
            .mockImplementationOnce(() => second.promise);
        const a = run(),
            b = run();
        expect(mocks.generateSignedUrl).toHaveBeenCalledTimes(2);
        second.resolve("signed-b");
        const resultB = await b;
        first.resolve("signed-a");
        const resultA = await a;
        expect(resultA.itemImageSignedUrls).toEqual([{ index: 0, url: "signed-a" }]);
        expect(resultB.itemImageSignedUrls).toEqual([{ index: 0, url: "signed-b" }]);
        expect(resultA.finalImageUrls).toEqual([url("item-image", "_0")]);
        expect(resultB.finalImageUrls).toEqual([url("item-image", "_0").replace("request-a", "request-b")]);
    });
    it.each([{ ids: [] }, { ids: ["red"] }, { ids: ["blue", "red"] }])(
        "AF-V02: 一意uiId=$idsをschemaで受理して既存画像の対応を保持する",
        async ({ ids }) => {
            body.attributes.colorVariants = ids.map((uiId) => ({ uiId, inventory: 1, sizes: [] }));
            body = schema.parse(body);
            const result = await run();
            expect(result.finalAttributesImageUrls).toEqual(
                Object.fromEntries(ids.map((id) => [id, `https://media.test/${id}`])),
            );
            expect(mocks.generateSignedUrl).not.toHaveBeenCalled();
        },
    );
});
