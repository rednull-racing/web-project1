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
import { createItemDraftBodySchema as schema } from "../../../../src/validators/body/itemDraft.js";
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
    it("S04: サムネイルだけ差し替え、動画と商品画像は引き継ぐ", async () => {
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
    it("S05 S05: 新規と既存を交互に指定して確定画像の入力順を維持する", async () => {
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
    it.each([null, ""])("S08 E04: 商品画像type=%sなら署名せず空の確定配列になる", async (type) => {
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
        ["S13", [0, 1, 2], [0, 1, 2]],
        ["S13", [0, 1, 2], [2, 1, 0]],
        ["S13", [0, 1, 2], [1, 0, 2]],
        ["S13", [1], [1]],
        ["S13", [0, 2], [2, 0]],
        ["S13", [1, 3], [3, 1]],
    ] as const)("%s S13 S13 S13: 新規index=%j・完了順=%jでも署名を全件返す", async (_id, targetIndices, order) => {
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
    it("S17 Q02: 時刻を進めて再実行すると新規アップロードURLが変わる", async () => {
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
    it("S17 S17 S17: 同一ミリ秒でもrequestIdが異なれば全メディアのキーが分かれる", async () => {
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

describe("S16: 各署名処理のreject", () => {
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

describe("P1: 境界とキー対応", () => {
    it.each([0, 1, 10])("S08 S08 V12: 新規署名%s件と確定画像の件数・対応を保持する", async (count) => {
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
    it("S17: 1回のrequestIdを全メディアで使い署名keyと公開URLを一致させる", async () => {
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
    it("S02: 全メディアを既存利用するとURLを保持して署名を発行しない", async () => {
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
    it("S17: 同時開始した別requestIdの署名を逆順完了しても呼出し間で混ざらない", async () => {
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
        "S10: 一意uiId=$idsをschemaで受理して既存画像の対応を保持する",
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

describe("P1/P2: 署名の待機と並行呼出しの対応", () => {
    it.each(["動画", "商品画像"])("S18: %sの最後の署名が保留中は次の段階へ進まない", async stage => {
        body.video = { name: "動画", type: "video/mp4", uploaded: false };
        body.thumbnail = upload(); body.itemImages = [upload(), upload()]; body.attributes.colorVariants[0].image = upload();
        const entered = deferred<void>(), release = deferred<string>();
        let done = false;
        if (stage === "動画") mocks.createVideoPresignedPost.mockImplementationOnce(async () => {
            entered.resolve(); await release.promise; return { url: "post", fields: {} };
        });
        else mocks.generateSignedUrl.mockImplementation(async ({ key: inputKey }: { key: string }) => {
            if (inputKey === key("item-image", "_1")) { entered.resolve(); return release.promise; }
            return `signed:${inputKey}`;
        });
        const pending = run().then(value => { done = true; return value; });
        try {
            await Promise.race([entered.promise, pending.then(() => { throw new Error("署名待合せ未到達"); })]);
            expect(done).toBe(false);
            if (stage === "動画") expect(mocks.generateSignedUrl).not.toHaveBeenCalled();
            else expect(mocks.generateSignedUrl.mock.calls.map(([params]) => params.key)).not.toContain(key("attributes", "_red"));
        } finally { release.resolve("signed-last"); await pending; }
        expect(done).toBe(true); expect((await pending).finalAttributesImageUrls.red).toBe(url("attributes", "_red"));
    });

    it("S14: 色署名が1件だけ保留中でもhelperは成功を返さない", async () => {
        body.attributes.colorVariants = ["red", "blue"].map(uiId => ({ uiId, inventory: 1, sizes: [], image: upload() }));
        const started = deferred<void>(), gate = deferred<string>(); let completed = false;
        mocks.generateSignedUrl.mockImplementation(async ({ key: inputKey }: { key: string }) => {
            if (inputKey.includes("_blue_")) { started.resolve(); return gate.promise; }
            return "signed-red";
        });
        const pending = run().then(value => { completed = true; return value; });
        try {
            await Promise.race([started.promise, pending.then(() => { throw new Error("色署名待合せ未到達"); })]);
            expect(completed).toBe(false);
        } finally { gate.resolve("signed-blue"); await pending; }
        expect((await pending).attributesImageSignedUrls).toEqual({ red: "signed-red", blue: "signed-blue" });
    });

    it.each(["video", "thumbnail", "item", "attribute"])("S16: %s失敗で次の署名群は未開始", async stage => {
        body.video = { name: "動画", type: "video/mp4", uploaded: false };
        body.thumbnail = upload(); body.itemImages = [upload()]; body.attributes.colorVariants[0].image = upload();
        const error = new Error(stage);
        if (stage === "video") mocks.createVideoPresignedPost.mockRejectedValueOnce(error);
        else mocks.generateSignedUrl.mockImplementation(async ({ key: inputKey }: { key: string }) => {
            if ((stage === "thumbnail" && inputKey.startsWith("thumbnail/")) ||
                (stage === "item" && inputKey.startsWith("item-image/")) ||
                (stage === "attribute" && inputKey.startsWith("attributes/"))) throw error;
            return `signed:${inputKey}`;
        });
        await expect(run()).rejects.toBe(error);
        expect(mocks.generateSignedUrl).toHaveBeenCalledTimes(stage === "video" ? 0 : stage === "thumbnail" ? 1 : stage === "item" ? 2 : 3);
    });

    it.each(["非配列", "空URL"])("S06: 既存画像%sは入力nameをURLとして採用しない", async mode => {
        Object.assign(item, { image_url: mode === "非配列" ? "https://untrusted.test/image" : [""] });
        const result = await run(); expect(result.finalImageUrls).toEqual([]); expect(result.itemImageSignedUrls).toEqual([]);
    });
    it("S12: 既存colorVariantsが非配列なら画像を再利用しない", async () => {
        Object.assign(item.attributes, { colorVariants: {} }); expect((await run()).finalAttributesImageUrls).toEqual({});
    });

    it("P10 S13 S14 S17: B→Aで商品画像と色署名を逆順完了しても元index/uiId/requestの対応を維持", async () => {
        item.image_url = ["old-0", "old-1", "old-2", "old-3"];
        body.itemImages = [{ ...upload(), uploaded: true }, upload(), { ...upload(), uploaded: true }, upload()];
        body.attributes.colorVariants = ["red", "blue"].map(uiId => ({ uiId, inventory: 1, sizes: [], image: upload() }));
        mocks.randomUUID.mockReturnValueOnce("request-a").mockReturnValueOnce("request-b");
        const gates = new Map<string, ReturnType<typeof deferred<string>>>();
        for (const requestId of ["request-a", "request-b"]) {
            for (const index of [1, 3]) gates.set(`item-image/7/11_${index}_1000_${requestId}`, deferred<string>());
            for (const uiId of ["red", "blue"]) gates.set(`attributes/7/11_${uiId}_1000_${requestId}`, deferred<string>());
        }
        const allItems = deferred<void>(), colorA = deferred<void>(), colorB = deferred<void>();
        let itemCalls = 0, colorACalls = 0, colorBCalls = 0;
        mocks.generateSignedUrl.mockImplementation(({ key: inputKey }: { key: string }) => {
            if (inputKey.startsWith("item-image/") && ++itemCalls === 4) allItems.resolve();
            if (inputKey.startsWith("attributes/") && inputKey.endsWith("request-a") && ++colorACalls === 2) colorA.resolve();
            if (inputKey.startsWith("attributes/") && inputKey.endsWith("request-b") && ++colorBCalls === 2) colorB.resolve();
            const gate = gates.get(inputKey); if (!gate) throw new Error("想定外の署名キーです"); return gate.promise;
        });
        let aDone = false;
        const pa = run().then(result => { aDone = true; return result; }), pb = run(), settled = Promise.allSettled([pa, pb]);
        const resolveGroup = (prefix: string, ids: readonly (string | number)[], requestId: string) => {
            for (const id of ids) {
                const inputKey = `${prefix}/7/11_${id}_1000_${requestId}`;
                gates.get(inputKey)!.resolve(`signed:${inputKey}`);
            }
        };
        try {
            await Promise.race([allItems.promise, pa.then(() => { throw new Error("Aが早期終了しました"); }), pb.then(() => { throw new Error("Bが早期終了しました"); })]);
            resolveGroup("item-image", [3, 1], "request-b");
            await Promise.race([colorB.promise, pb.then(() => { throw new Error("Bの色署名未到達"); })]);
            resolveGroup("attributes", ["blue", "red"], "request-b"); const rb = await pb; expect(aDone).toBe(false);
            resolveGroup("item-image", [3, 1], "request-a");
            await Promise.race([colorA.promise, pa.then(() => { throw new Error("Aの色署名未到達"); })]);
            resolveGroup("attributes", ["blue", "red"], "request-a"); const ra = await pa;
            for (const [result, requestId] of [[ra, "request-a"], [rb, "request-b"]] as const) {
                expect(result.itemImageSignedUrls).toEqual([
                    { index: 1, url: `signed:item-image/7/11_1_1000_${requestId}` },
                    { index: 3, url: `signed:item-image/7/11_3_1000_${requestId}` },
                ]);
                expect(result.finalImageUrls).toEqual(["old-0", `https://media.test/item-image/7/11_1_1000_${requestId}`, "old-2", `https://media.test/item-image/7/11_3_1000_${requestId}`]);
                expect(result.attributesImageSignedUrls).toEqual({ red: `signed:attributes/7/11_red_1000_${requestId}`, blue: `signed:attributes/7/11_blue_1000_${requestId}` });
                expect(result.finalAttributesImageUrls).toEqual({ red: `https://media.test/attributes/7/11_red_1000_${requestId}`, blue: `https://media.test/attributes/7/11_blue_1000_${requestId}` });
            }
        } finally { for (const gate of gates.values()) gate.resolve("cleanup"); await settled; }
    });
});
