import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, expectAppError, makeBody, makeItem } from "./fixtures.js";

const mocks = vi.hoisted(() => ({
    randomUUID: vi.fn(),
    transaction: vi.fn(),
    getMyItemEditing: vi.fn(),
    updateConfirm: vi.fn(),
    updateItemEditingImage: vi.fn(),
    getCategories: vi.fn(),
    getItemCondition: vi.fn(),
    getShippingDay: vi.fn(),
    getShippingService: vi.fn(),
    getTodouhuken: vi.fn(),
    getBrand: vi.fn(),
    getBrandOne: vi.fn(),
    getAliasOne: vi.fn(),
    createAliases: vi.fn(),
    generateSignedUrl: vi.fn(),
    createVideoPresignedPost: vi.fn(),
}));
vi.mock("node:crypto", () => ({ randomUUID: mocks.randomUUID }));
vi.mock("../../../../src/db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../../src/services/itemEditing/query.js", () => ({ getMyItemEditing: mocks.getMyItemEditing }));
vi.mock("../../../../src/services/itemEditing/command.js", () => ({
    updateConfirm: mocks.updateConfirm,
    updateItemEditingImage: mocks.updateItemEditingImage,
}));
vi.mock("../../../../src/services/categories.js", () => ({ getCategories: mocks.getCategories }));
vi.mock("../../../../src/services/itemConditionOption.js", () => ({ getItemCondition: mocks.getItemCondition }));
vi.mock("../../../../src/services/shippingDayOption.js", () => ({ getShippingDay: mocks.getShippingDay }));
vi.mock("../../../../src/services/shippingServiceOption.js", () => ({ getShippingService: mocks.getShippingService }));
vi.mock("../../../../src/services/todouhuken.js", () => ({ getTodouhuken: mocks.getTodouhuken }));
vi.mock("../../../../src/services/brands.js", () => ({ getBrand: mocks.getBrand, getBrandOne: mocks.getBrandOne }));
vi.mock("../../../../src/services/brandAliases.js", () => ({
    getAliasOne: mocks.getAliasOne,
    createAliases: mocks.createAliases,
}));
vi.mock("../../../../src/infra/aws/s3.js", () => ({ publicS3Domain: "https://media.test" }));
vi.mock("../../../../src/utils/s3/index.js", () => ({
    generateSignedUrl: mocks.generateSignedUrl,
    createVideoPresignedPost: mocks.createVideoPresignedPost,
}));
import { updateItemEditingConfirmBodySchema as schema } from "../../../../src/validators/body/itemEditing.js";
import { buildSignedUrls } from "../../../../src/usecases/shared/buildSignedUrls.js";
import { validateNumber } from "../../../../src/usecases/shared/validateNumber.js";
import { validateMaster } from "../../../../src/usecases/shared/validateMaster.js";
import { resolveBrand } from "../../../../src/usecases/shared/resolveBrand.js";
import { updateItemEditingConfirmUseCase } from "../../../../src/usecases/itemEditing/updateConfirm.js";

let body: ReturnType<typeof makeBody>;
let item: ReturnType<typeof makeItem>;
const transaction = { id: "transaction" };
const brand = { id: 61 };
const category = { id: 21, body_category: "upper", lifestyle_category: "casual", layer: "outer" };
const masters = ["getCategories", "getItemCondition", "getShippingDay", "getShippingService", "getTodouhuken"] as const;
const params = { categoryId: 21, conditionId: 31, dayId: 41, serviceId: 51, placeId: 13 };
const run = () => updateItemEditingConfirmUseCase({ itemEditingId: 11, userId: 7, body });
const noWrites = () => {
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateConfirm).not.toHaveBeenCalled();
    expect(mocks.updateItemEditingImage).not.toHaveBeenCalled();
};
const byName = (name: string | null = "新ブランド") => {
    body.brand = { id: null, name };
    mocks.getBrand.mockResolvedValue(null);
};

beforeEach(() => {
    vi.resetAllMocks();
    body = makeBody();
    item = makeItem();
    mocks.getMyItemEditing.mockResolvedValue(item);
    mocks.randomUUID.mockReturnValue("request-a");
    mocks.transaction.mockImplementation(async (cb: (t: typeof transaction) => Promise<void>) => cb(transaction));
    for (const key of masters) mocks[key].mockResolvedValue({ id: 1 });
    mocks.getCategories.mockResolvedValue(category);
    mocks.getBrand.mockResolvedValue(brand);
    mocks.getBrandOne.mockResolvedValue(null);
    mocks.getAliasOne.mockResolvedValue(null);
    mocks.createAliases.mockResolvedValue({ id: 71, brand_id: null });
    mocks.generateSignedUrl.mockResolvedValue("signed-image");
    mocks.createVideoPresignedPost.mockResolvedValue({ url: "signed-video", fields: {} });
});

const numberTargets = [
    ["category", "id", "categoryId"],
    ["condition", "id", "conditionId"],
    ["shipping", "day", "dayId"],
    ["shipping", "service", "serviceId"],
    ["shipping", "place", "placeId"],
    ["brand", "id", "brandId"],
] as const;

describe.each(numberTargets)("P0/P1: 数値変換 %s.%s → %s", (group, key, output) => {
    it.each([
        ["I01", null, null],
        ["I01", "", null],
        ["I02", "1", 1],
        ["I02", "01", 1],
        ["I02", " 1 ", 1],
        ["I02", "1e2", 100],
        ["I03", "0", 0],
        ["I03", "  ", 0],
        ["I04", "-1", -1],
        ["I04", "1.5", 1.5],
        ["I04", "Infinity", Infinity],
    ])("%s: %sを%sへ変換する", async (_id, input, expected) => {
        Object.assign(body[group], { [key]: input });
        // helperの宣言型は別API用。ここでは実際の呼出元と同じbodyを渡す。
        const result = await validateNumber({ body: body as unknown as Parameters<typeof validateNumber>[0]["body"] });
        expect(result[output]).toBe(expected);
    });
    it.each(["abc", "NaN"])("E05 I05 T06: %sを拒否し署名発行後でも商品transactionを開始しない", async (value) => {
        Object.assign(body[group], { [key]: value });
        body.thumbnail = { name: "新画像", type: "image/png", uploaded: false };
        await expectAppError(run(), "INVALID_NUMBER");
        expect(mocks.generateSignedUrl).toHaveBeenCalledOnce();
        for (const key of masters) expect(mocks[key]).not.toHaveBeenCalled();
        expect(mocks.getBrand).not.toHaveBeenCalled();
        noWrites();
    });
});

describe("P1: マスター検証と実helperの接続", () => {
    it("I05 E15: 数値変換はcategoryから順番に行い不正で停止する", async () => {
        const reads: string[] = [];
        for (const [group, key, output] of numberTargets)
            Object.defineProperty(body[group], key, {
                get: () => {
                    reads.push(output);
                    return output === "conditionId" ? "abc" : "21";
                },
            });
        await expectAppError(run(), "INVALID_NUMBER");
        expect(reads).toEqual(["categoryId", "conditionId"]);
        noWrites();
    });
    it("I06 N07: 有効な各IDを対応serviceへ渡しカテゴリを返す", async () => {
        expect(await validateMaster(params)).toBe(category);
        const expected = [
            { categoryId: 21 },
            { conditionId: 31 },
            { dayId: 41 },
            { serviceId: 51 },
            { todouhukenId: 13 },
        ];
        masters.forEach((name, index) => expect(mocks[name]).toHaveBeenCalledExactlyOnceWith(expected[index]));
    });
    describe.each(Object.keys(params) as Array<keyof typeof params>)("I06: %s", (key) => {
        it.each([null, 0])("%sはそのマスターだけ検索しない", async (value) => {
            const index = Object.keys(params).indexOf(key);
            await validateMaster({ ...params, [key]: value });
            masters.forEach((name, i) => expect(mocks[name]).toHaveBeenCalledTimes(i === index ? 0 : 1));
        });
    });
    it("I03: ID=0を検索せず保存引数へ渡す（外部キー未検証）", async () => {
        body.category.id = "0";
        await run();
        expect(mocks.getCategories).not.toHaveBeenCalled();
        expect(mocks.updateConfirm.mock.calls[0][0].data.category_id).toBe(0);
    });
    it.each(["-1", "1.5", "Infinity"])("I04: 数値%sは取得serviceまで到達する", async (value) => {
        body.category.id = value;
        mocks.getCategories.mockResolvedValue(null);
        await expectAppError(run(), "CATEGORY_NOT_FOUND", 404);
        expect(mocks.getCategories).toHaveBeenCalledWith({ categoryId: Number(value) });
        noWrites();
    });
    it.each([
        ["E06", 0, "CATEGORY_NOT_FOUND"],
        ["E07", 1, "ITEM_CONDITION_NOT_FOUND"],
        ["E08", 2, "SHIPPING_DAY_NOT_FOUND"],
        ["E09", 3, "SHIPPING_SERVICE_NOT_FOUND"],
        ["E10", 4, "PLACE_NOT_FOUND"],
    ] as const)("%s T06: %s番目のマスターなしで%sを返す", async (_id, index, code) => {
        mocks[masters[index]].mockResolvedValue(null);
        await expectAppError(run(), code, 404);
        for (const name of masters.slice(index + 1)) expect(mocks[name]).not.toHaveBeenCalled();
        expect(mocks.getBrand).not.toHaveBeenCalled();
        noWrites();
    });
    it.each(masters)("E11: %sの取得例外を伝播し後続を停止する", async (name) => {
        const error = new Error(name);
        mocks[name].mockRejectedValue(error);
        await expect(run()).rejects.toBe(error);
        for (const later of masters.slice(masters.indexOf(name) + 1)) expect(mocks[later]).not.toHaveBeenCalled();
        noWrites();
    });
    it("E15: 数値不正はマスター不在より優先する", async () => {
        body.shipping.place = "abc";
        mocks.getCategories.mockResolvedValue(null);
        await expectAppError(run(), "INVALID_NUMBER");
        expect(mocks.getCategories).not.toHaveBeenCalled();
    });
    it("N01 Q01: 実helper経由で同じ既存URLを2回更新し同一の業務値を渡す", async () => {
        const a = await run(),
            b = await run();
        expect(a).toEqual(b);
        expect(mocks.updateConfirm).toHaveBeenCalledTimes(2);
        expect(mocks.updateConfirm.mock.calls[0][0].data).toEqual(mocks.updateConfirm.mock.calls[1][0].data);
        expect(mocks.updateItemEditingImage).toHaveBeenCalledTimes(2);
        expect(mocks.generateSignedUrl).not.toHaveBeenCalled();
        expect(mocks.createAliases).not.toHaveBeenCalled();
    });
});

describe("P1/P2: ブランド解決と副作用の境界", () => {
    it("AF-B01 B01: IDが有効なら名前検索を行わない", async () => {
        expect(await resolveBrand({ brandId: 61, body })).toEqual({ brand, alias: null });
        expect(mocks.getBrand).toHaveBeenCalledExactlyOnceWith({ brandId: 61 });
        expect(mocks.getAliasOne).not.toHaveBeenCalled();
        expect(mocks.getBrandOne).not.toHaveBeenCalled();
        expect(mocks.createAliases).not.toHaveBeenCalled();
    });
    it("I06: brandId=0もgetBrandへ渡す", async () => {
        await resolveBrand({ brandId: 0, body });
        expect(mocks.getBrand).toHaveBeenCalledWith({ brandId: 0 });
    });
    describe.each([null, 999])("AF-B01 B02: brandId=%s", (brandId) => {
        it.each([null, ""])("名前%sなら未選択のまま返す", async (name) => {
            byName(name);
            expect(await resolveBrand({ brandId, body })).toEqual({ brand: null, alias: null });
            expect(mocks.getBrand).toHaveBeenCalledTimes(brandId === null ? 0 : 1);
            expect(mocks.getAliasOne).not.toHaveBeenCalled();
            expect(mocks.createAliases).not.toHaveBeenCalled();
        });
    });
    it("AF-B02 B03 B08: brand付きaliasを採用して後続検索・作成を止める", async () => {
        byName();
        const alias = { id: 71, brand };
        mocks.getAliasOne.mockResolvedValue(alias);
        mocks.getBrandOne.mockResolvedValue(brand);
        expect(await resolveBrand({ brandId: null, body })).toEqual({ brand, alias });
        expect(mocks.getBrandOne).not.toHaveBeenCalled();
        expect(mocks.createAliases).not.toHaveBeenCalled();
    });
    it.each([
        [" ＡＢc カタカナ ", "abcかたかな"],
        [" ﾃｽﾄ　Brand ", "てすとbrand"],
    ])("AF-B07 B04: %sを%sに正規化して検索・作成する", async (name, normalized) => {
        byName(name);
        expect(await resolveBrand({ brandId: null, body })).toEqual({ brand: null, alias: { id: 71, brand_id: null } });
        expect(mocks.getAliasOne).toHaveBeenCalledExactlyOnceWith({ normalized });
        expect(mocks.getBrandOne).toHaveBeenCalledExactlyOnceWith({ normalized });
        expect(mocks.createAliases).toHaveBeenCalledExactlyOnceWith({ inputName: name, normalized, transaction: undefined });
    });
    it("AF-B03 B05 O02: 名前で見つかったブランドを商品更新のIDへ採用する", async () => {
        byName();
        mocks.getBrandOne.mockResolvedValue(brand);
        await run();
        expect(mocks.updateConfirm.mock.calls[0][0].data).toMatchObject({ brand_id: 61, brand_aliases_id: null });
        expect(mocks.createAliases).not.toHaveBeenCalled();
    });
    it.each([
        ["", 0, 0],
        ["名", 1, 0],
        ["名前", 1, 1],
    ] as const)("AF-B06 AF-B07 B06: 名前%sは検索%s回・別名作成%s回で作成結果を返す", async (name, search, create) => {
        byName(name);
        expect(await resolveBrand({ brandId: null, body })).toEqual({
            brand: null,
            alias: create ? { id: 71, brand_id: null } : null,
        });
        expect(mocks.getAliasOne).toHaveBeenCalledTimes(search);
        expect(mocks.getBrandOne).toHaveBeenCalledTimes(search);
        expect(mocks.createAliases).toHaveBeenCalledTimes(create);
    });
    it.each([false, true])(
        "AF-B02 AF-B04 B07 B08: 既存aliasのbrand有無=%sに応じて再利用し追加作成しない",
        async (linked) => {
            byName();
            const alias = { id: 70, brand: linked ? brand : null };
            mocks.getAliasOne.mockResolvedValue(alias);
            expect(await resolveBrand({ brandId: null, body })).toEqual(
                linked ? { brand, alias } : { brand: null, alias },
            );
            expect(mocks.createAliases).not.toHaveBeenCalled();
            expect(mocks.getBrandOne).toHaveBeenCalledTimes(linked ? 0 : 1);
        },
    );
    it.each([
        ["  ", ""],
        ["😀", "😀"],
    ])("AF-B07 B09: %sの元文字列lengthで作成を判断する", async (name, normalized) => {
        byName(name);
        expect(await resolveBrand({ brandId: null, body })).toEqual({ brand: null, alias: { id: 71, brand_id: null } });
        expect(mocks.createAliases).toHaveBeenCalledWith({ inputName: name, normalized, transaction: undefined });
    });
    it.each(["getBrand", "getAliasOne", "getBrandOne", "createAliases"] as const)(
        "AF-B09 B10 E11: transaction内の%sの失敗を伝播し商品更新へ進まない",
        async (name) => {
            if (name !== "getBrand") byName();
            const error = new Error(name);
            mocks[name].mockRejectedValue(error);
            await expect(run()).rejects.toBe(error);
            const steps = ["getBrand", "getAliasOne", "getBrandOne", "createAliases"] as const;
            for (const later of steps.slice(steps.indexOf(name) + 1)) expect(mocks[later]).not.toHaveBeenCalled();
            expect(mocks.updateConfirm).not.toHaveBeenCalled();
            expect(mocks.updateItemEditingImage).not.toHaveBeenCalled();
            expect(mocks.transaction).toHaveBeenCalledOnce();
            expect(mocks.transaction.mock.invocationCallOrder[0]).toBeLessThan(
                mocks[name].mock.invocationCallOrder[0],
            );
            await expect(mocks.transaction.mock.results[0].value).rejects.toBe(error);
        },
    );
    it("AF-B10 T05: transaction内で別名作成後に本体更新が失敗すると画像更新へ進まない（永続化未検証）", async () => {
        byName();
        const error = new Error("update failed");
        mocks.updateConfirm.mockRejectedValue(error);
        await expect(run()).rejects.toBe(error);
        expect(mocks.createAliases).toHaveBeenCalledExactlyOnceWith({
            inputName: "新ブランド",
            normalized: "新ぶらんど",
            transaction,
        });
        expect(mocks.transaction).toHaveBeenCalledOnce();
        const calls = [mocks.transaction, mocks.createAliases, mocks.updateConfirm].map(
            (fn) => fn.mock.invocationCallOrder[0],
        );
        expect(calls).toEqual([...calls].sort((a, b) => a - b));
        await expect(mocks.transaction.mock.results[0].value).rejects.toBe(error);
        expect(mocks.updateItemEditingImage).not.toHaveBeenCalled();
    });
    it("AF-B08 Q03 O02: 初回に作成したaliasが再検索で返れば2回目は再利用する", async () => {
        byName();
        const alias = { id: 71, brand_id: null, brand: null };
        mocks.createAliases.mockResolvedValue(alias);
        mocks.getAliasOne.mockResolvedValueOnce(null).mockResolvedValueOnce(alias);
        await run();
        await run();
        expect(mocks.getAliasOne).toHaveBeenCalledTimes(2);
        expect(mocks.createAliases).toHaveBeenCalledExactlyOnceWith({
            inputName: "新ブランド",
            normalized: "新ぶらんど",
            transaction,
        });
        expect(mocks.updateConfirm).toHaveBeenCalledTimes(2);
        for (const [args] of mocks.updateConfirm.mock.calls)
            expect(args.data).toMatchObject({ brand_id: null, brand_aliases_id: 71 });
    });
    it("P05: 両検索が未登録を返す順序で並行実行すると双方が別名作成へ進む", async () => {
        byName();
        const both = deferred<void>(),
            release = deferred<null>();
        let count = 0;
        mocks.getBrandOne.mockImplementation(() => {
            if (++count === 2) both.resolve();
            return release.promise;
        });
        const pending = Promise.all([run(), run()]);
        await both.promise;
        expect(mocks.createAliases).not.toHaveBeenCalled();
        release.resolve(null);
        await pending;
        expect(mocks.createAliases).toHaveBeenCalledTimes(2);
        expect(mocks.transaction).toHaveBeenCalledTimes(2);
    });
});

describe("F2: ブランド解決から商品更新への接続", () => {
    it("AF-B01: 指定IDが見つからなければ名前でブランドを解決する", async () => {
        body.brand.id = "999";
        mocks.getBrand.mockResolvedValue(null);
        mocks.getBrandOne.mockResolvedValue(brand);
        await run();
        expect(mocks.getBrand).toHaveBeenCalledExactlyOnceWith({ brandId: 999 });
        expect(mocks.getAliasOne).toHaveBeenCalledExactlyOnceWith({ normalized: "ぶらんど" });
        expect(mocks.getBrandOne).toHaveBeenCalledExactlyOnceWith({ normalized: "ぶらんど" });
        expect(mocks.createAliases).not.toHaveBeenCalled();
        expect(mocks.updateConfirm.mock.calls[0][0].data).toMatchObject({ brand_id: 61, brand_aliases_id: null });
    });
    it.each([
        ["AF-B02", true, false, 61, 70, 0],
        ["AF-B04", false, false, null, 70, 1],
        ["AF-B05", false, true, 61, null, 1],
    ] as const)(
        "%s: aliasのbrand=%s・名前検索のbrand=%sを優先順どおり更新引数へ渡す",
        async (_id, linked, canonical, brandId, aliasId, searches) => {
            byName();
            const alias = { id: 70, brand: linked ? brand : null };
            mocks.getAliasOne.mockResolvedValue(alias);
            mocks.getBrandOne.mockResolvedValue(canonical ? brand : null);
            const before = structuredClone(alias);
            await run();
            expect(mocks.updateConfirm.mock.calls[0][0].data).toMatchObject({
                brand_id: brandId,
                brand_aliases_id: aliasId,
            });
            expect(mocks.createAliases).not.toHaveBeenCalled();
            expect(mocks.getBrandOne).toHaveBeenCalledTimes(searches);
            expect(alias).toEqual(before);
        },
    );
    it("AF-B06: 新規aliasのIDを商品更新引数に採用する", async () => {
        byName();
        await run();
        expect(mocks.createAliases).toHaveBeenCalledExactlyOnceWith({
            inputName: "新ブランド",
            normalized: "新ぶらんど",
            transaction,
        });
        expect(mocks.updateConfirm.mock.calls[0][0].data).toMatchObject({ brand_id: null, brand_aliases_id: 71 });
    });
    it("AF-B10: transaction内で実ブランド解決の完了を待って商品更新へ進む", async () => {
        byName();
        const alias = deferred<{ id: number }>(),
            started = deferred<void>();
        mocks.createAliases.mockImplementation(() => {
            started.resolve();
            return alias.promise;
        });
        let callbackCompleted = false;
        mocks.transaction.mockImplementation(async (cb: (t: typeof transaction) => Promise<void>) => {
            await cb(transaction);
            callbackCompleted = true;
        });
        const pending = run();
        await started.promise;
        const transactionCallsBeforeResolution = mocks.transaction.mock.calls.length;
        try {
            expect(callbackCompleted).toBe(false);
            expect(mocks.updateConfirm).not.toHaveBeenCalled();
            expect(mocks.updateItemEditingImage).not.toHaveBeenCalled();
        } finally {
            alias.resolve({ id: 71 });
            await pending;
        }
        const calls = [mocks.transaction, mocks.createAliases, mocks.updateConfirm, mocks.updateItemEditingImage].map(
            (fn) => fn.mock.invocationCallOrder[0],
        );
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.updateConfirm.mock.calls[0][0].transaction).toBe(transaction);
        expect(mocks.updateItemEditingImage.mock.calls[0][0].transaction).toBe(transaction);
        expect(transactionCallsBeforeResolution).toBe(1);
        expect(callbackCompleted).toBe(true);
        expect(calls).toEqual([...calls].sort((a, b) => a - b));
    });
});

const noMasterOrWrites = () => {
    for (const name of [...masters, "getBrand", "getAliasOne", "getBrandOne", "createAliases"] as const)
        expect(mocks[name]).not.toHaveBeenCalled();
    noWrites();
};

describe("F1/F3/F4: 実helperとusecaseを接続した更新前チェック", () => {
    it("AF-I02 V10: 空画像はschemaを通過するが実helper・usecase経由では400になる", async () => {
        body.itemImages = [];
        body = schema.parse(body);
        const urls = await buildSignedUrls({
            body,
            userId: 7,
            itemEditingId: 11,
            itemEditing: item as unknown as Parameters<typeof buildSignedUrls>[0]["itemEditing"],
        });
        expect(urls.finalImageUrls).toEqual([]);
        await expectAppError(run(), "ITEM_IMAGE_NULL");
        noMasterOrWrites();
    });
    it.each(["既存URLなし", "type=null", "type空文字", "混在"])(
        "AF-I03: %sで確定画像が全件なくなると400で停止する",
        async (mode) => {
            item.image_url = [];
            const missingType = { name: "新画像", type: mode === "type空文字" ? "" : null, uploaded: false };
            if (mode === "混在") body.itemImages.push(missingType);
            else if (mode !== "既存URLなし") body.itemImages = [missingType];
            body = schema.parse(body);
            await expectAppError(run(), "ITEM_IMAGE_NULL");
            noMasterOrWrites();
        },
    );
    it.each([1, 10])("AF-I04: 確定画像%s件で先頭と全画像を更新serviceへ渡す", async (count) => {
        item.image_url = Array.from({ length: count }, (_, i) => `https://media.test/old-${i}`);
        body.itemImages = item.image_url.map((name) => ({ name, type: "image/png", uploaded: true }));
        await run();
        expect(mocks.updateConfirm.mock.calls[0][0].data.first_image_url).toBe(item.image_url[0]);
        expect(mocks.updateItemEditingImage).toHaveBeenCalledExactlyOnceWith({
            itemEditing: item,
            urls: item.image_url,
            transaction,
        });
    });
    it("AF-S06: 飛び飛びの新規indexを返し既存を含む確定画像を全件更新へ渡す", async () => {
        body.itemImages = Array.from({ length: 4 }, (_, index) => ({
            name: "画像",
            type: "image/png",
            uploaded: index % 2 === 0,
        }));
        mocks.generateSignedUrl.mockImplementation(async ({ key }: { key: string }) => `signed:${key}`);
        const result = await run();
        const keys = mocks.generateSignedUrl.mock.calls.map(([args]) => args.key as string);
        expect(keys).toHaveLength(2);
        expect(keys[0]).toMatch(/^item-image\/7\/11_1_\d+_request-a$/);
        expect(keys[1]).toBe(keys[0].replace("11_1_", "11_3_"));
        expect(result).toEqual({
            videoSignedUrl: null,
            thumbnailSignedUrl: null,
            itemImageSignedUrls: [
                { index: 1, url: `signed:${keys[0]}` },
                { index: 3, url: `signed:${keys[1]}` },
            ],
            attributesImageSignedUrls: {},
        });
        expect(mocks.updateConfirm.mock.calls[0][0].data.first_image_url).toBe(item.image_url[0]);
        expect(mocks.updateItemEditingImage).toHaveBeenCalledExactlyOnceWith({
            itemEditing: item,
            urls: [
                item.image_url[0],
                `https://media.test/${keys[0]}`,
                item.image_url[2],
                `https://media.test/${keys[1]}`,
            ],
            transaction,
        });
    });
    it("AF-S05: 並行署名の1件がrejectすれば実helperから同じ例外を伝播して更新しない", async () => {
        body.itemImages = Array.from({ length: 2 }, () => ({ name: "新画像", type: "image/png", uploaded: false }));
        const first = deferred<string>(),
            second = deferred<string>(),
            started = deferred<void>();
        mocks.generateSignedUrl
            .mockImplementationOnce(() => first.promise)
            .mockImplementationOnce(() => {
                started.resolve();
                return second.promise;
            });
        const error = new Error("署名失敗");
        const result = expect(run()).rejects.toBe(error);
        await started.promise;
        expect(mocks.generateSignedUrl).toHaveBeenCalledTimes(2);
        second.reject(error);
        await result;
        noMasterOrWrites();
        first.resolve("signed-first");
        await first.promise;
    });
    it.each(["requestId", "video", "thumbnail", "item", "attribute"])(
        "AF-K05: %sの失敗を伝播して商品更新を止める",
        async (target) => {
            const error = new Error(target);
            if (target === "requestId")
                mocks.randomUUID.mockImplementation(() => {
                    throw error;
                });
            else if (target === "video") {
                body.video = { name: "動画", type: "video/mp4", uploaded: false };
                mocks.createVideoPresignedPost.mockRejectedValue(error);
            } else {
                const image = { name: "画像", type: "image/png", uploaded: false };
                if (target === "thumbnail") body.thumbnail = image;
                if (target === "item") body.itemImages = [image];
                if (target === "attribute") body.attributes.colorVariants[0].image = image;
                mocks.generateSignedUrl.mockRejectedValue(error);
            }
            await expect(run()).rejects.toBe(error);
            noMasterOrWrites();
            if (target === "requestId") {
                expect(mocks.generateSignedUrl).not.toHaveBeenCalled();
                expect(mocks.createVideoPresignedPost).not.toHaveBeenCalled();
            }
        },
    );
});
