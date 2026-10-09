import { beforeEach, describe, expect, it, vi } from "vitest";
import type { updateConfirm } from "../../../../src/services/itemEditing/command.js";
import { deferred, expectAppError, makeBody, makeItem } from "./fixtures.js";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    getMyItemEditing: vi.fn(),
    updateConfirm: vi.fn<typeof updateConfirm>(),
    updateItemEditingImage: vi.fn(),
    buildSignedUrls: vi.fn(),
    validateNumber: vi.fn(),
    validateMaster: vi.fn(),
    resolveBrand: vi.fn(),
}));
vi.mock("../../../../src/db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../../src/services/itemEditing/query.js", () => ({ getMyItemEditing: mocks.getMyItemEditing }));
vi.mock("../../../../src/services/itemEditing/command.js", () => ({
    updateConfirm: mocks.updateConfirm,
    updateItemEditingImage: mocks.updateItemEditingImage,
}));
vi.mock("../../../../src/usecases/itemEditing/shared/buildSignedUrls.js", () => ({
    buildSignedUrls: mocks.buildSignedUrls,
}));
vi.mock("../../../../src/usecases/itemEditing/shared/validateNumber.js", () => ({
    validateNumber: mocks.validateNumber,
}));
vi.mock("../../../../src/usecases/itemEditing/shared/validateMaster.js", () => ({
    validateMaster: mocks.validateMaster,
}));
vi.mock("../../../../src/usecases/itemEditing/shared/resolveBrand.js", () => ({ resolveBrand: mocks.resolveBrand }));
import { updateItemEditingConfirmUseCase } from "../../../../src/usecases/itemEditing/updateConfirm.js";

const transaction = { id: "test-transaction" };
const ids = { categoryId: 21, conditionId: 31, dayId: 41, serviceId: 51, placeId: 13, brandId: 61 };
const category = { body_category: "upper", lifestyle_category: "casual", layer: "outer" };
const makeUrls = () => ({
    videoSignedUrl: { url: "https://upload.test/video", fields: { key: "video" } },
    videoUrl: "https://media.test/new-video",
    thumbnailSignedUrl: "signed-thumbnail",
    thumbnailUrl: "https://media.test/new-thumbnail",
    itemImageSignedUrls: [{ index: 0, url: "signed-item" }],
    finalImageUrls: ["image-a", "image-b"],
    attributesImageSignedUrls: { red: "signed-red" },
    finalAttributesImageUrls: { red: "image-red", blue: "image-blue" },
});
let body: ReturnType<typeof makeBody>;
let item: ReturnType<typeof makeItem>;
const run = () => updateItemEditingConfirmUseCase({ itemEditingId: 11, userId: 7, body });
const data = () => mocks.updateConfirm.mock.calls[0][0].data;
const inventory = (n: number) => ({ initial: n, current: n, low_stock_ratio: 0.2 });

beforeEach(() => {
    vi.resetAllMocks();
    body = makeBody();
    item = makeItem();
    mocks.getMyItemEditing.mockResolvedValue(item);
    mocks.buildSignedUrls.mockResolvedValue(makeUrls());
    mocks.validateNumber.mockResolvedValue(ids);
    mocks.validateMaster.mockResolvedValue(category);
    mocks.resolveBrand.mockResolvedValue({ brand: { id: 61 }, alias: { id: 71 } });
    mocks.updateConfirm.mockResolvedValue(undefined);
    mocks.updateItemEditingImage.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback: (t: typeof transaction) => Promise<void>) =>
        callback(transaction),
    );
});

describe("P0: usecaseの更新と処理順序", () => {
    it("N01 N02 N05 T01: 全保存項目・引数・順序と署名4項目の返却を確認する", async () => {
        body.attributes.colorVariants.push({
            uiId: "blue",
            color: "青",
            inventory: 4,
            sizes: [
                { size: "L", inventory: 5 },
                { size: "XL", inventory: 6 },
            ],
        });
        const result = await run();
        expect(mocks.getMyItemEditing).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 11, userId: 7 });
        expect(mocks.buildSignedUrls).toHaveBeenCalledExactlyOnceWith({
            itemEditingId: 11,
            userId: 7,
            itemEditing: item,
            body,
        });
        expect(mocks.validateNumber).toHaveBeenCalledExactlyOnceWith({ body });
        expect(mocks.validateMaster).toHaveBeenCalledExactlyOnceWith({
            categoryId: 21,
            conditionId: 31,
            dayId: 41,
            serviceId: 51,
            placeId: 13,
        });
        expect(mocks.resolveBrand).toHaveBeenCalledExactlyOnceWith({ brandId: 61, body });
        expect(mocks.updateConfirm).toHaveBeenCalledExactlyOnceWith({
            itemEditing: item,
            transaction,
            data: {
                name: "商品名",
                detail: "商品説明",
                price: 300,
                before_price: 300,
                first_image_url: "image-a",
                category_id: 21,
                gender_type: "unisex",
                age_type: "both",
                brand_id: 61,
                brand_aliases_id: 71,
                item_condition_id: 31,
                attributes: {
                    inventory: inventory(1),
                    colorVariants: [
                        {
                            uiId: "red",
                            color: "赤",
                            inventory: inventory(2),
                            image_url: "image-red",
                            sizes: [{ size: "M", inventory: inventory(3) }],
                        },
                        {
                            uiId: "blue",
                            color: "青",
                            inventory: inventory(4),
                            image_url: "image-blue",
                            sizes: [
                                { size: "L", inventory: inventory(5) },
                                { size: "XL", inventory: inventory(6) },
                            ],
                        },
                    ],
                    materials: [
                        { name: "綿", ratio: 80 },
                        { name: "麻", ratio: 20 },
                    ],
                    ...category,
                },
                title: "動画タイトル",
                summary: "動画説明",
                original_url: "https://media.test/new-video",
                thumbnail_url: "https://media.test/new-thumbnail",
                shipping_day_id: 41,
                shipping_service_id: 51,
                shipping_place_id: 13,
                shipping_service_free_text: "配送備考",
            },
        });
        expect(mocks.updateItemEditingImage).toHaveBeenCalledExactlyOnceWith({
            itemEditing: item,
            urls: ["image-a", "image-b"],
            transaction,
        });
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.updateConfirm.mock.calls[0][0].transaction).toBe(transaction);
        expect(mocks.updateItemEditingImage.mock.calls[0][0].transaction).toBe(transaction);
        const order = [
            mocks.getMyItemEditing,
            mocks.buildSignedUrls,
            mocks.validateNumber,
            mocks.validateMaster,
            mocks.transaction,
            mocks.resolveBrand,
            mocks.updateConfirm,
            mocks.updateItemEditingImage,
        ].map((m) => m.mock.invocationCallOrder[0]);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        const urls = makeUrls();
        expect(result).toEqual({
            videoSignedUrl: urls.videoSignedUrl,
            thumbnailSignedUrl: urls.thumbnailSignedUrl,
            itemImageSignedUrls: urls.itemImageSignedUrls,
            attributesImageSignedUrls: urls.attributesImageSignedUrls,
        });
    });

    it.each([null, "", "説明文"])("N03: detail・summary=%sを規定どおり変換する", async (value) => {
        body.itemMeta.detail = value;
        body.videoMeta.summary = value;
        await run();
        expect(data()).toMatchObject({ detail: value ?? "", summary: value ?? "" });
    });
    it.each([null, "", "配送指定"])("N02: 配送自由文%sを保持する", async (value) => {
        body.shipping.freeText = value;
        await run();
        expect(data().shipping_service_free_text).toBe(value);
    });
    it.each([0, 1, 8])("N04 ST03: 在庫%sを各階層のinitial/currentへ設定する", async (value) => {
        body.attributes.allInventory = value;
        body.attributes.colorVariants[0].inventory = value;
        body.attributes.colorVariants[0].sizes[0].inventory = value;
        await run();
        const attrs = data().attributes;
        expect(attrs.inventory).toEqual(inventory(value));
        expect(attrs.colorVariants?.[0].inventory).toEqual(inventory(value));
        expect(attrs.colorVariants?.[0].sizes?.[0].inventory).toEqual(inventory(value));
    });
    it("N06: 空の色・素材はundefinedで更新する", async () => {
        body.attributes.colorVariants = [];
        body.attributes.materials = [];
        await run();
        expect(data().attributes).toMatchObject({ colorVariants: undefined, materials: undefined });
    });
    it("N06: 空のサイズ配列を維持する", async () => {
        body.attributes.colorVariants[0].sizes = [];
        await run();
        expect(data().attributes.colorVariants?.[0].sizes).toEqual([]);
    });
    it.each([null, { body_category: null, lifestyle_category: null, layer: null }])(
        "N07: カテゴリ分類なし(%j)をundefinedへ変換する",
        async (value) => {
            mocks.validateMaster.mockResolvedValue(value);
            await run();
            expect(data().attributes).toMatchObject({
                body_category: undefined,
                lifestyle_category: undefined,
                layer: undefined,
            });
        },
    );
    it.each([
        [{ brand: { id: 61 }, alias: { id: 71 } }, 61, 71],
        [{ brand: { id: 61 }, alias: null }, 61, null],
        [{ brand: null, alias: null }, null, null],
    ])("N08: ブランド解決結果%jを保存引数へ渡す", async (result, brandId, aliasId) => {
        mocks.resolveBrand.mockResolvedValue(result);
        await run();
        expect(data()).toMatchObject({ brand_id: brandId, brand_aliases_id: aliasId });
    });
    it.each([undefined, ""])("N09: 色名%sと空サイズ名を保持し対応画像なしはundefined", async (color) => {
        body.attributes.colorVariants[0].color = color;
        body.attributes.colorVariants[0].sizes[0].size = "";
        mocks.buildSignedUrls.mockResolvedValue({ ...makeUrls(), finalAttributesImageUrls: {} });
        await run();
        expect(data().attributes.colorVariants?.[0]).toMatchObject({
            color,
            image_url: undefined,
            sizes: [{ size: "", inventory: inventory(3) }],
        });
    });
    it.each([null, undefined])("N10: HTTPでは到達しない在庫%sを1へ補完する", async (value) => {
        // schema通過後には生じない値を、防御分岐の確認に限って設定する。
        Object.assign(body.attributes, { allInventory: value });
        Object.assign(body.attributes.colorVariants[0], { inventory: value });
        Object.assign(body.attributes.colorVariants[0].sizes[0], { inventory: value });
        await run();
        expect(data().attributes.inventory).toEqual(inventory(1));
        expect(data().attributes.colorVariants?.[0].inventory).toEqual(inventory(1));
        expect(data().attributes.colorVariants?.[0].sizes?.[0].inventory).toEqual(inventory(1));
    });
    it.each([null, "pending", "completed"])("ST06: video_status=%sによる分岐や動画状態の更新がない", async (status) => {
        item.video_status = status;
        await run();
        for (const key of [
            "seller_id",
            "item_id",
            "video_status",
            "converted_url",
            "duration",
            "sale_flag",
            "discount_rate",
            "discount_amount",
            "createdAt",
        ])
            expect(data()).not.toHaveProperty(key);
    });
    describe.each([null, "old-first"])("AF-I01 E04 O01: 既存先頭画像=%s", (first) => {
        it.each([[], null, undefined])("確定画像%jなら400で数値検証以降を実行しない", async (urls) => {
            Object.assign(item, { first_image_url: first });
            mocks.buildSignedUrls.mockResolvedValue({ ...makeUrls(), finalImageUrls: urls });
            await expectAppError(run(), "ITEM_IMAGE_NULL");
            for (const fn of [
                mocks.validateNumber,
                mocks.validateMaster,
                mocks.resolveBrand,
                mocks.transaction,
                mocks.updateConfirm,
                mocks.updateItemEditingImage,
            ])
                expect(fn).not.toHaveBeenCalled();
        });
    });
});

describe("P0: 失敗伝播と後続未実行", () => {
    it("E01 E15: 取得なしはURL検証より先に404で停止する", async () => {
        mocks.getMyItemEditing.mockResolvedValue(null);
        mocks.buildSignedUrls.mockResolvedValue({});
        await expectAppError(run(), "ITEM_EDITING_NOT_FOUND", 404);
        expect(mocks.buildSignedUrls).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
    it.each([
        ["E02", "videoUrl", null, "VIDEO_URL_NULL"],
        ["E02", "videoUrl", "", "VIDEO_URL_NULL"],
        ["E03", "thumbnailUrl", null, "THUMBNAIL_URL_NULL"],
        ["E03", "thumbnailUrl", "", "THUMBNAIL_URL_NULL"],
        ["E04", "finalImageUrls", null, "ITEM_IMAGE_NULL"],
        ["E04", "finalImageUrls", undefined, "ITEM_IMAGE_NULL"],
    ])("%s: %s=%sで%sとなり数値検証以降を呼ばない", async (_id, field, value, code) => {
        mocks.buildSignedUrls.mockResolvedValue({ ...makeUrls(), [field]: value });
        await expectAppError(run(), String(code));
        expect(mocks.validateNumber).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
    it.each([
        [null, null, "VIDEO_URL_NULL"],
        ["valid-video", null, "THUMBNAIL_URL_NULL"],
        ["valid-video", "valid-thumbnail", "ITEM_IMAGE_NULL"],
    ])("AF-I05 E15: 動画%s・サムネイル%s・画像0件なら%sを優先する", async (videoUrl, thumbnailUrl, code) => {
        mocks.buildSignedUrls.mockResolvedValue({ ...makeUrls(), videoUrl, thumbnailUrl, finalImageUrls: [] });
        await expectAppError(run(), String(code));
        for (const fn of [
            mocks.validateNumber,
            mocks.validateMaster,
            mocks.resolveBrand,
            mocks.transaction,
            mocks.updateConfirm,
            mocks.updateItemEditingImage,
        ])
            expect(fn).not.toHaveBeenCalled();
    });
    const stages = [
        "getMyItemEditing",
        "buildSignedUrls",
        "validateNumber",
        "validateMaster",
        "resolveBrand",
        "updateConfirm",
        "updateItemEditingImage",
    ] as const;
    it.each(stages)("E11 E12 E13 T06: %sの例外をそのまま伝え後続を実行しない", async (stage) => {
        const error = new Error(stage);
        mocks[stage].mockRejectedValueOnce(error);
        await expect(run()).rejects.toBe(error);
        for (const later of stages.slice(stages.indexOf(stage) + 1)) expect(mocks[later]).not.toHaveBeenCalled();
        if (stages.indexOf(stage) < stages.indexOf("resolveBrand")) {
            expect(mocks.transaction).not.toHaveBeenCalled();
        } else {
            expect(mocks.transaction).toHaveBeenCalledOnce();
            await expect(mocks.transaction.mock.results[0].value).rejects.toBe(error);
        }
    });
    it.each(["開始", "完了"])("E14: transaction%sの失敗を伝播する", async (phase) => {
        const error = new Error(phase);
        mocks.transaction.mockImplementation(async (callback: (t: typeof transaction) => Promise<void>) => {
            if (phase === "完了") await callback(transaction);
            throw error;
        });
        await expect(run()).rejects.toBe(error);
        expect(mocks.resolveBrand).toHaveBeenCalledTimes(phase === "開始" ? 0 : 1);
        expect(mocks.updateConfirm).toHaveBeenCalledTimes(phase === "開始" ? 0 : 1);
        expect(mocks.updateItemEditingImage).toHaveBeenCalledTimes(phase === "開始" ? 0 : 1);
    });
    it("AF-B10 T02: 本体・画像・transactionの完了をそれぞれ待つ", async () => {
        const main = deferred<void>(),
            images = deferred<void>(),
            commit = deferred<void>();
        const mainStarted = deferred<void>(),
            imageStarted = deferred<void>(),
            commitStarted = deferred<void>();
        mocks.updateConfirm.mockImplementation(() => {
            mainStarted.resolve();
            return main.promise;
        });
        mocks.updateItemEditingImage.mockImplementation(() => {
            imageStarted.resolve();
            return images.promise;
        });
        mocks.transaction.mockImplementation(async (cb: (t: typeof transaction) => Promise<void>) => {
            await cb(transaction);
            commitStarted.resolve();
            await commit.promise;
        });
        let settled = false;
        const result = run().then((value) => {
            settled = true;
            return value;
        });
        await mainStarted.promise;
        expect(mocks.updateItemEditingImage).not.toHaveBeenCalled();
        expect(settled).toBe(false);
        main.resolve();
        await imageStarted.promise;
        expect(settled).toBe(false);
        images.resolve();
        await commitStarted.promise;
        expect(settled).toBe(false);
        commit.resolve();
        await result;
        expect(settled).toBe(true);
    });
});
