import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    deferred,
    expectAppError,
    makeBody,
    makeItem,
} from "../../../../fixtures/itemDraft/createItemDraft/fixtures.js";

const mocks = vi.hoisted(() => ({
    randomUUID: vi.fn(),
    transaction: vi.fn(),
    getMyItemEditing: vi.fn(),
    CreateItemDraft: vi.fn(),
    updateItemDraftImage: vi.fn(),
    deleteItemEditing: vi.fn(),
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
vi.mock("../../../../../src/db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../../../src/services/itemEditing/query.js", () => ({ getMyItemEditing: mocks.getMyItemEditing }));
vi.mock("../../../../../src/services/itemEditing/command.js", () => ({ deleteItemEditing: mocks.deleteItemEditing }));
vi.mock("../../../../../src/services/itemDraft/command.js", () => ({
    CreateItemDraft: mocks.CreateItemDraft,
    updateItemDraftImage: mocks.updateItemDraftImage,
}));
vi.mock("../../../../../src/services/categories/categories.js", () => ({ getCategories: mocks.getCategories }));
vi.mock("../../../../../src/services/itemConditionOption/itemConditionOption.js", () => ({
    getItemCondition: mocks.getItemCondition,
}));
vi.mock("../../../../../src/services/shippingDayOption/shippingDayOption.js", () => ({
    getShippingDay: mocks.getShippingDay,
}));
vi.mock("../../../../../src/services/shippingServiceOption/shippingServiceOption.js", () => ({
    getShippingService: mocks.getShippingService,
}));
vi.mock("../../../../../src/services/todouhuken/todouhuken.js", () => ({ getTodouhuken: mocks.getTodouhuken }));
vi.mock("../../../../../src/services/brands/brands.js", () => ({
    getBrand: mocks.getBrand,
    getBrandOne: mocks.getBrandOne,
}));
vi.mock("../../../../../src/services/brandAliases/brandAliases.js", () => ({
    getAliasOne: mocks.getAliasOne,
    createAliases: mocks.createAliases,
}));
vi.mock("../../../../../src/infra/aws/s3.js", () => ({ publicS3Domain: "https://media.test" }));
vi.mock("../../../../../src/utils/s3/index.js", () => ({
    generateSignedUrl: mocks.generateSignedUrl,
    createVideoPresignedPost: mocks.createVideoPresignedPost,
}));
import { createItemDraftBodySchema as schema } from "../../../../../src/validators/body/itemDraft.js";
import { buildSignedUrls } from "../../../../../src/usecases/shared/buildSignedUrls.js";
import { validateNumber } from "../../../../../src/usecases/shared/validateNumber.js";
import { validateMaster } from "../../../../../src/usecases/shared/validateMaster.js";
import { resolveBrand } from "../../../../../src/usecases/shared/resolveBrand.js";
import { createItemDraftUseCase } from "../../../../../src/usecases/itemDraft/createItemDraft.js";

let body: ReturnType<typeof makeBody>;
let item: ReturnType<typeof makeItem>;
const transaction = { id: "transaction" };
const draft = { id: 101 };
const brand = { id: 61 };
const category = { id: 21, body_category: "top", lifestyle_category: "casual", layer: "outer" };
const masters = ["getCategories", "getItemCondition", "getShippingDay", "getShippingService", "getTodouhuken"] as const;
const params = { categoryId: 21, conditionId: 31, dayId: 41, serviceId: 51, placeId: 13 };
const run = () => createItemDraftUseCase({ userId: 7, body });
const noWrites = () => {
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.CreateItemDraft).not.toHaveBeenCalled();
    expect(mocks.updateItemDraftImage).not.toHaveBeenCalled();
    expect(mocks.deleteItemEditing).not.toHaveBeenCalled();
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
    mocks.CreateItemDraft.mockResolvedValue(draft);
    mocks.deleteItemEditing.mockResolvedValue(undefined);
    mocks.randomUUID.mockReturnValue("request-a");
    mocks.transaction.mockImplementation(async (cb: (t: typeof transaction) => Promise<number>) => cb(transaction));
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
        ["AF-I02", "  ", null],
        ["AF-I02", "\t\n", null],
        ["AF-I02", "2147483646", 2147483646],
        ["AF-I02", "2147483647", 2147483647],
    ])("%s: %sを%sへ変換する", async (_id, input, expected) => {
        Object.assign(body[group], { [key]: input });
        // helperの宣言型は別API用。ここでは実際の呼出元と同じbodyを渡す。
        const result = await validateNumber({ body: body as unknown as Parameters<typeof validateNumber>[0]["body"] });
        expect(result[output]).toBe(expected);
    });
    it.each([
        ["I05", "abc"],
        ["I05", "NaN"],
        ["I03", "0"],
        ["I04", "-1"],
        ["I04", "1.5"],
        ["I04", "Infinity"],
        ["I04", "-Infinity"],
        ["AF-I01", "2147483648"],
        ["AF-I01", "1e20"],
    ])("%s AF-I01 E06 T08: %sを拒否し署名発行後でも商品transactionを開始しない", async (_id, value) => {
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
    it("I05 E13: 数値変換はcategoryから順番に行い不正で停止する", async () => {
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
    it("M01 N07: 有効な各IDを対応serviceへ渡しカテゴリを返す", async () => {
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
    describe.each(Object.keys(params) as Array<keyof typeof params>)("M01: %s", (key) => {
        it.each([null, 0])("%sはそのマスターだけ検索しない", async (value) => {
            const index = Object.keys(params).indexOf(key);
            await validateMaster({ ...params, [key]: value });
            masters.forEach((name, i) => expect(mocks[name]).toHaveBeenCalledTimes(i === index ? 0 : 1));
        });
    });
    it("AF-I02 I03: 空白だけのIDをnullとして保存し対応マスターを検索しない", async () => {
        body.category.id = "  ";
        await run();
        expect(mocks.getCategories).not.toHaveBeenCalled();
        expect(mocks.CreateItemDraft.mock.calls[0][0].data.category_id).toBeNull();
    });
    it.each([
        ["E07", 0, "CATEGORY_NOT_FOUND"],
        ["E07", 1, "ITEM_CONDITION_NOT_FOUND"],
        ["E07", 2, "SHIPPING_DAY_NOT_FOUND"],
        ["E07", 3, "SHIPPING_SERVICE_NOT_FOUND"],
        ["E07", 4, "PLACE_NOT_FOUND"],
    ] as const)("%s T08: %s番目のマスターなしで%sを返す", async (_id, index, code) => {
        mocks[masters[index]].mockResolvedValue(null);
        await expectAppError(run(), code, 404);
        for (const name of masters.slice(index + 1)) expect(mocks[name]).not.toHaveBeenCalled();
        expect(mocks.getBrand).not.toHaveBeenCalled();
        noWrites();
    });
    it.each(masters)("E08 M03: %sの取得例外を伝播し後続を停止する", async (name) => {
        const error = new Error(name);
        mocks[name].mockRejectedValue(error);
        await expect(run()).rejects.toBe(error);
        for (const later of masters.slice(masters.indexOf(name) + 1)) expect(mocks[later]).not.toHaveBeenCalled();
        noWrites();
    });
    it("E13: 数値不正はマスター不在より優先する", async () => {
        body.shipping.place = "abc";
        mocks.getCategories.mockResolvedValue(null);
        await expectAppError(run(), "INVALID_NUMBER");
        expect(mocks.getCategories).not.toHaveBeenCalled();
    });
    it("N01 Q01: 実helper経由で同じ既存URLを2回作成し同一の業務値を渡す", async () => {
        const a = await run(),
            b = await run();
        expect(a).toEqual(b);
        expect(mocks.CreateItemDraft).toHaveBeenCalledTimes(2);
        expect(mocks.CreateItemDraft.mock.calls[0][0].data).toEqual(mocks.CreateItemDraft.mock.calls[1][0].data);
        expect(mocks.updateItemDraftImage).toHaveBeenCalledTimes(2);
        expect(mocks.generateSignedUrl).not.toHaveBeenCalled();
        expect(mocks.createAliases).not.toHaveBeenCalled();
    });
});

describe("P1/P2: ブランド解決と副作用の境界", () => {
    it("B01: IDが有効なら名前検索を行わない", async () => {
        expect(await resolveBrand({ brandId: 61, body })).toEqual({ brand, alias: null });
        expect(mocks.getBrand).toHaveBeenCalledExactlyOnceWith({ brandId: 61 });
        expect(mocks.getAliasOne).not.toHaveBeenCalled();
        expect(mocks.getBrandOne).not.toHaveBeenCalled();
        expect(mocks.createAliases).not.toHaveBeenCalled();
    });
    it("M01: brandId=0もgetBrandへ渡す", async () => {
        await resolveBrand({ brandId: 0, body });
        expect(mocks.getBrand).toHaveBeenCalledWith({ brandId: 0 });
    });
    describe.each([null, 999])("B01 B02: brandId=%s", (brandId) => {
        it.each([null, ""])("名前%sなら未選択のまま返す", async (name) => {
            byName(name);
            expect(await resolveBrand({ brandId, body })).toEqual({ brand: null, alias: null });
            expect(mocks.getBrand).toHaveBeenCalledTimes(brandId === null ? 0 : 1);
            expect(mocks.getAliasOne).not.toHaveBeenCalled();
            expect(mocks.createAliases).not.toHaveBeenCalled();
        });
    });
    it("B03: brand付きaliasを採用して後続検索・作成を止める", async () => {
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
    ])("B08: %sを%sに正規化して検索・作成する", async (name, normalized) => {
        byName(name);
        expect(await resolveBrand({ brandId: null, body })).toEqual({ brand: null, alias: { id: 71, brand_id: null } });
        expect(mocks.getAliasOne).toHaveBeenCalledExactlyOnceWith({ normalized });
        expect(mocks.getBrandOne).toHaveBeenCalledExactlyOnceWith({ normalized });
        expect(mocks.createAliases).toHaveBeenCalledExactlyOnceWith({
            inputName: name,
            normalized,
            transaction: undefined,
        });
    });
    it.each([false, true])("B06: 作成時の再検索で再利用したaliasのbrand有無=%sを更新へ渡す", async (linked) => {
        byName();
        const alias = { id: 72, brand_id: linked ? brand.id : null, brand: linked ? brand : null };
        mocks.createAliases.mockResolvedValue(alias);
        await run();
        expect(mocks.createAliases).toHaveBeenCalledTimes(1);
        expect(mocks.CreateItemDraft.mock.calls[0][0].data).toMatchObject({
            brand_id: linked ? brand.id : null,
            brand_aliases_id: alias.id,
        });
    });
    it("B04 B06: 名前で見つかったブランドを下書き作成のIDへ採用する", async () => {
        byName();
        mocks.getBrandOne.mockResolvedValue(brand);
        await run();
        expect(mocks.CreateItemDraft.mock.calls[0][0].data).toMatchObject({ brand_id: 61, brand_aliases_id: null });
        expect(mocks.createAliases).not.toHaveBeenCalled();
    });
    it.each([
        ["", 0, 0],
        ["名", 1, 0],
        ["名前", 1, 1],
    ] as const)("B06 B08 B07: 名前%sは検索%s回・別名作成%s回で作成結果を返す", async (name, search, create) => {
        byName(name);
        expect(await resolveBrand({ brandId: null, body })).toEqual({
            brand: null,
            alias: create ? { id: 71, brand_id: null } : null,
        });
        expect(mocks.getAliasOne).toHaveBeenCalledTimes(search);
        expect(mocks.getBrandOne).toHaveBeenCalledTimes(search);
        expect(mocks.createAliases).toHaveBeenCalledTimes(create);
    });
    it.each([false, true])("B03 B05: 既存aliasのbrand有無=%sに応じて再利用し追加作成しない", async (linked) => {
        byName();
        const alias = { id: 70, brand: linked ? brand : null };
        mocks.getAliasOne.mockResolvedValue(alias);
        expect(await resolveBrand({ brandId: null, body })).toEqual(linked ? { brand, alias } : { brand: null, alias });
        expect(mocks.createAliases).not.toHaveBeenCalled();
        expect(mocks.getBrandOne).toHaveBeenCalledTimes(linked ? 0 : 1);
    });
    it.each([
        ["  ", ""],
        ["😀", "😀"],
    ])("B08 B07: %sの元文字列lengthで作成を判断する", async (name, normalized) => {
        byName(name);
        expect(await resolveBrand({ brandId: null, body })).toEqual({ brand: null, alias: { id: 71, brand_id: null } });
        expect(mocks.createAliases).toHaveBeenCalledWith({ inputName: name, normalized, transaction: undefined });
    });
    it.each(["getBrand", "getAliasOne", "getBrandOne", "createAliases"] as const)(
        "B09 E09: transaction内の%sの失敗を伝播し下書き作成へ進まない",
        async (name) => {
            if (name !== "getBrand") byName();
            const error = new Error(name);
            mocks[name].mockRejectedValue(error);
            await expect(run()).rejects.toBe(error);
            const steps = ["getBrand", "getAliasOne", "getBrandOne", "createAliases"] as const;
            for (const later of steps.slice(steps.indexOf(name) + 1)) expect(mocks[later]).not.toHaveBeenCalled();
            expect(mocks.CreateItemDraft).not.toHaveBeenCalled();
            expect(mocks.updateItemDraftImage).not.toHaveBeenCalled();
            expect(mocks.transaction).toHaveBeenCalledOnce();
            expect(mocks.transaction.mock.invocationCallOrder[0]).toBeLessThan(mocks[name].mock.invocationCallOrder[0]);
            await expect(mocks.transaction.mock.results[0].value).rejects.toBe(error);
        },
    );
    it("T02 E10: transaction内で別名作成後に本体更新が失敗すると画像更新へ進まない（永続化未検証）", async () => {
        byName();
        const error = new Error("update failed");
        mocks.CreateItemDraft.mockRejectedValue(error);
        await expect(run()).rejects.toBe(error);
        expect(mocks.createAliases).toHaveBeenCalledExactlyOnceWith({
            inputName: "新ブランド",
            normalized: "新ぶらんど",
            transaction,
        });
        expect(mocks.transaction).toHaveBeenCalledOnce();
        const calls = [mocks.transaction, mocks.createAliases, mocks.CreateItemDraft].map(
            (fn) => fn.mock.invocationCallOrder[0],
        );
        expect(calls).toEqual([...calls].sort((a, b) => a - b));
        await expect(mocks.transaction.mock.results[0].value).rejects.toBe(error);
        expect(mocks.updateItemDraftImage).not.toHaveBeenCalled();
    });
    it("Q03 B06: 初回に作成したaliasが再検索で返れば2回目は再利用する", async () => {
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
        expect(mocks.CreateItemDraft).toHaveBeenCalledTimes(2);
        for (const [args] of mocks.CreateItemDraft.mock.calls)
            expect(args.data).toMatchObject({ brand_id: null, brand_aliases_id: 71 });
    });
    it("AF-SAFE01 B06: 両検索が未登録を返す順序で並行実行すると双方が別名作成へ進む", async () => {
        byName();
        const both = deferred<void>(),
            release = deferred<null>();
        let count = 0;
        mocks.getBrandOne.mockImplementation(() => {
            if (++count === 2) both.resolve();
            return release.promise;
        });
        const operations = [run(), run()];
        const pending = Promise.all(operations);
        try {
            await Promise.race([
                both.promise,
                pending.then(() => {
                    throw new Error("両検索待合せ未到達");
                }),
            ]);
            expect(mocks.createAliases).not.toHaveBeenCalled();
            release.resolve(null);
            await pending;
        } finally {
            release.resolve(null);
            await Promise.allSettled(operations);
        }
        expect(mocks.createAliases).toHaveBeenCalledTimes(2);
        expect(mocks.transaction).toHaveBeenCalledTimes(2);
    });
});

describe("P1: ブランド解決から下書き作成への接続", () => {
    it("B01: 指定IDが見つからなければ名前でブランドを解決する", async () => {
        body.brand.id = "999";
        mocks.getBrand.mockResolvedValue(null);
        mocks.getBrandOne.mockResolvedValue(brand);
        await run();
        expect(mocks.getBrand).toHaveBeenCalledExactlyOnceWith({ brandId: 999 });
        expect(mocks.getAliasOne).toHaveBeenCalledExactlyOnceWith({ normalized: "ぶらんど" });
        expect(mocks.getBrandOne).toHaveBeenCalledExactlyOnceWith({ normalized: "ぶらんど" });
        expect(mocks.createAliases).not.toHaveBeenCalled();
        expect(mocks.CreateItemDraft.mock.calls[0][0].data).toMatchObject({ brand_id: 61, brand_aliases_id: null });
    });
    it.each([
        ["B03", true, false, 61, 70, 0],
        ["B05", false, false, null, 70, 1],
        ["B04", false, true, 61, null, 1],
    ] as const)(
        "%s: aliasのbrand=%s・名前検索のbrand=%sを優先順どおり作成引数へ渡す",
        async (_id, linked, canonical, brandId, aliasId, searches) => {
            byName();
            const alias = { id: 70, brand: linked ? brand : null };
            mocks.getAliasOne.mockResolvedValue(alias);
            mocks.getBrandOne.mockResolvedValue(canonical ? brand : null);
            const before = structuredClone(alias);
            await run();
            expect(mocks.CreateItemDraft.mock.calls[0][0].data).toMatchObject({
                brand_id: brandId,
                brand_aliases_id: aliasId,
            });
            expect(mocks.createAliases).not.toHaveBeenCalled();
            expect(mocks.getBrandOne).toHaveBeenCalledTimes(searches);
            expect(alias).toEqual(before);
        },
    );
    it("B06: 新規aliasのIDを下書き作成引数に採用する", async () => {
        byName();
        await run();
        expect(mocks.createAliases).toHaveBeenCalledExactlyOnceWith({
            inputName: "新ブランド",
            normalized: "新ぶらんど",
            transaction,
        });
        expect(mocks.CreateItemDraft.mock.calls[0][0].data).toMatchObject({ brand_id: null, brand_aliases_id: 71 });
    });
    it("T02: transaction内で実ブランド解決の完了を待って下書き作成へ進む", async () => {
        byName();
        const alias = deferred<{ id: number }>(),
            started = deferred<void>();
        mocks.createAliases.mockImplementation(() => {
            started.resolve();
            return alias.promise;
        });
        let callbackCompleted = false;
        mocks.transaction.mockImplementation(async (cb: (t: typeof transaction) => Promise<number>) => {
            const itemDraftId = await cb(transaction);
            callbackCompleted = true;
            return itemDraftId;
        });
        const pending = run();
        await started.promise;
        const transactionCallsBeforeResolution = mocks.transaction.mock.calls.length;
        try {
            expect(callbackCompleted).toBe(false);
            expect(mocks.CreateItemDraft).not.toHaveBeenCalled();
            expect(mocks.updateItemDraftImage).not.toHaveBeenCalled();
        } finally {
            alias.resolve({ id: 71 });
            await pending;
        }
        const calls = [mocks.transaction, mocks.createAliases, mocks.CreateItemDraft, mocks.updateItemDraftImage].map(
            (fn) => fn.mock.invocationCallOrder[0],
        );
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.CreateItemDraft.mock.calls[0][0].transaction).toBe(transaction);
        expect(mocks.updateItemDraftImage.mock.calls[0][0].transaction).toBe(transaction);
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

describe("P0: 実helperとusecaseを接続した更新前チェック", () => {
    it("E04 V12: 空画像はschemaを通過するが実helper・usecase経由では400になる", async () => {
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
        "E04: %sで確定画像が全件なくなると400で停止する",
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
    it.each([1, 10])("S05: 確定画像%s件で先頭と全画像を更新serviceへ渡す", async (count) => {
        item.image_url = Array.from({ length: count }, (_, i) => `https://media.test/old-${i}`);
        body.itemImages = item.image_url.map((name) => ({ name, type: "image/png", uploaded: true }));
        await run();
        expect(mocks.CreateItemDraft.mock.calls[0][0].data.first_image_url).toBe(item.image_url[0]);
        expect(mocks.updateItemDraftImage).toHaveBeenCalledExactlyOnceWith({
            itemDraft: draft,
            urls: item.image_url,
            transaction,
        });
    });
    it("S13: 飛び飛びの新規indexを返し既存を含む確定画像を全件保存へ渡す", async () => {
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
            itemDraftId: 101,
            videoSignedUrl: null,
            thumbnailSignedUrl: null,
            itemImageSignedUrls: [
                { index: 1, url: `signed:${keys[0]}` },
                { index: 3, url: `signed:${keys[1]}` },
            ],
            attributesImageSignedUrls: {},
        });
        expect(mocks.CreateItemDraft.mock.calls[0][0].data.first_image_url).toBe(item.image_url[0]);
        expect(mocks.updateItemDraftImage).toHaveBeenCalledExactlyOnceWith({
            itemDraft: draft,
            urls: [
                item.image_url[0],
                `https://media.test/${keys[0]}`,
                item.image_url[2],
                `https://media.test/${keys[1]}`,
            ],
            transaction,
        });
    });
    it("S16: 並行署名の1件がrejectすれば実helperから同じ例外を伝播して更新しない", async () => {
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
        try {
            await Promise.race([started.promise, result]);
            expect(mocks.generateSignedUrl).toHaveBeenCalledTimes(2);
            second.reject(error);
            await result;
            noMasterOrWrites();
        } finally {
            first.resolve("signed-first");
            second.resolve("signed-second");
            await Promise.allSettled([first.promise, second.promise, result]);
        }
    });
    it.each(["requestId", "video", "thumbnail", "item", "attribute"])(
        "S16: %sの失敗を伝播して下書き作成を止める",
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

describe("P0/P1: 実helperの待機・優先順位とusecaseへの接続", () => {
    it.each([null, ""])("E02: 実helperの動画URL%sは数値検証前に拒否", async (value) => {
        Object.assign(item, { original_url: value, converted_url: null });
        await expectAppError(run(), "VIDEO_URL_NULL");
        noMasterOrWrites();
    });
    it.each([null, ""])("E03: 実helperのサムネイルURL%sは保存前に拒否", async (value) => {
        item.thumbnail_url = value;
        await expectAppError(run(), "THUMBNAIL_URL_NULL");
        noMasterOrWrites();
    });
    it("E14: 動画URLなしでも先に開始した商品画像署名の失敗を伝播", async () => {
        Object.assign(item, { original_url: null, converted_url: null });
        body.itemImages = [{ name: "画像", type: "image/png", uploaded: false }];
        const error = new Error("画像署名失敗");
        mocks.generateSignedUrl.mockRejectedValueOnce(error);
        await expect(run()).rejects.toBe(error);
        noMasterOrWrites();
    });
    it("AF-SIGN01 S15 O05: 新規動画の署名undefinedは後続署名・数値・transaction前に500で停止", async () => {
        body.video = { name: "動画", type: "video/mp4", uploaded: false };
        body.thumbnail = { name: "画像", type: "image/png", uploaded: false };
        body.itemImages = [{ name: "画像", type: "image/png", uploaded: false }];
        body.attributes.colorVariants[0].image = { name: "色", type: "image/png", uploaded: false };
        mocks.createVideoPresignedPost.mockResolvedValueOnce(undefined);
        const numberRead = vi.fn(() => "21");
        Object.defineProperty(body.category, "id", { get: numberRead });
        await expectAppError(run(), "VIDEO_SIGNED_URL_UNAVAILABLE", 500);
        expect(mocks.createVideoPresignedPost).toHaveBeenCalledOnce();
        expect(mocks.generateSignedUrl).not.toHaveBeenCalled();
        expect(numberRead).not.toHaveBeenCalled();
        noMasterOrWrites();
    });
    it.each(masters)("M03: %sを保留中は後続検索もtransactionも未開始", async (stage) => {
        const entered = deferred<void>(),
            release = deferred<{ id: number }>();
        mocks[stage].mockImplementationOnce(() => {
            entered.resolve();
            return release.promise;
        });
        const pending = run();
        try {
            await Promise.race([
                entered.promise,
                pending.then(() => {
                    throw new Error("検索待合せに到達しませんでした");
                }),
            ]);
            for (const later of masters.slice(masters.indexOf(stage) + 1)) expect(mocks[later]).not.toHaveBeenCalled();
            noWrites();
        } finally {
            release.resolve({ id: 1 });
            await pending;
        }
        expect(mocks.CreateItemDraft).toHaveBeenCalledOnce();
    });
    it.each([0, 1, 2, 3, 4])("M02 E07: %s番目以降がすべて不存在なら先頭のエラーで停止", async (index) => {
        for (const stage of masters.slice(index)) mocks[stage].mockResolvedValue(null);
        const codes = [
            "CATEGORY_NOT_FOUND",
            "ITEM_CONDITION_NOT_FOUND",
            "SHIPPING_DAY_NOT_FOUND",
            "SHIPPING_SERVICE_NOT_FOUND",
            "PLACE_NOT_FOUND",
        ];
        await expectAppError(run(), codes[index], 404);
        for (const later of masters.slice(index + 1)) expect(mocks[later]).not.toHaveBeenCalled();
        noWrites();
    });
    it.each(["getBrand", "getAliasOne", "getBrandOne", "createAliases"] as const)(
        "B09 E09: %sの完了を待ってから作成へ進む",
        async (stage) => {
            if (stage !== "getBrand") byName();
            const entered = deferred<void>(),
                release = deferred<unknown>();
            mocks[stage].mockImplementationOnce(() => {
                entered.resolve();
                return release.promise;
            });
            const pending = run();
            const steps = ["getBrand", "getAliasOne", "getBrandOne", "createAliases"] as const;
            try {
                await Promise.race([
                    entered.promise,
                    pending.then(() => {
                        throw new Error("ブランド待合せに到達しませんでした");
                    }),
                ]);
                for (const later of steps.slice(steps.indexOf(stage) + 1)) expect(mocks[later]).not.toHaveBeenCalled();
                expect(mocks.transaction).toHaveBeenCalledOnce();
                expect(mocks.CreateItemDraft).not.toHaveBeenCalled();
                expect(mocks.updateItemDraftImage).not.toHaveBeenCalled();
            } finally {
                release.resolve(stage === "getBrand" ? brand : stage === "createAliases" ? { id: 71 } : null);
                await pending;
            }
            expect(mocks.CreateItemDraft).toHaveBeenCalledOnce();
        },
    );
    it.each(numberTargets)("I01: %s.%sの空文字を実usecaseの保存へnullとして渡す", async (group, key, output) => {
        Object.assign(body[group], { [key]: "" });
        if (output === "brandId") body.brand.name = null;
        await run();
        const column = {
            categoryId: "category_id",
            conditionId: "item_condition_id",
            dayId: "shipping_day_id",
            serviceId: "shipping_service_id",
            placeId: "shipping_place_id",
            brandId: "brand_id",
        }[output];
        expect(mocks.CreateItemDraft.mock.calls[0][0].data[column]).toBeNull();
    });
});

describe("P1: 署名・画像helperの結果を作成データへ接続", () => {
    it.each([
        ["S01 S03", "新規動画"],
        ["S04", "新規サムネイル"],
        ["S09", "新規色画像"],
        ["S10", "既存色の逆順"],
        ["S11", "不完全な新規色画像"],
        ["S06 S08", "一部商品画像欠落"],
    ])("%s AF-NAME01: %sの保存値と返却署名を対応させる", async (_id, mode) => {
        const now = vi.spyOn(Date, "now").mockReturnValue(1000);
        try {
            if (mode === "新規動画") {
                item.converted_url = "converted";
                body.video = { name: "動画", type: "video/mp4", uploaded: false };
            }
            if (mode === "新規サムネイル") body.thumbnail = { name: "画像", type: "image/png", uploaded: false };
            if (mode === "新規色画像")
                body.attributes.colorVariants[0].image = { name: "赤", type: "image/png", uploaded: false };
            if (mode === "既存色の逆順")
                body.attributes.colorVariants = ["blue", "red"].map((uiId) => ({ uiId, inventory: 1, sizes: [] }));
            if (mode === "不完全な新規色画像") body.attributes.colorVariants[0].image = { name: "赤", uploaded: false };
            if (mode === "一部商品画像欠落")
                body.itemImages = [
                    { name: "type欠落", type: null, uploaded: false },
                    { name: "既存", type: "image/png", uploaded: true },
                    { name: "新規", type: "image/png", uploaded: false },
                ];
            const result = await run(),
                saved = mocks.CreateItemDraft.mock.calls[0][0].data;
            if (mode === "新規動画") {
                expect(saved.original_url).toBe("https://media.test/video/original/7/11_1000_request-a");
                expect(saved).not.toHaveProperty("converted_url");
                expect(result.videoSignedUrl).toEqual({ url: "signed-video", fields: {} });
            }
            if (mode === "新規サムネイル") {
                expect(saved.thumbnail_url).toBe("https://media.test/thumbnail/7/11_1000_request-a");
                expect(result.thumbnailSignedUrl).toBe("signed-image");
            }
            if (mode === "新規色画像") {
                expect(saved.attributes.colorVariants[0].image_url).toBe(
                    "https://media.test/attributes/7/11_red_1000_request-a",
                );
                expect(result.attributesImageSignedUrls).toEqual({ red: "signed-image" });
            }
            if (mode === "既存色の逆順") {
                expect(
                    saved.attributes.colorVariants.map((v: { uiId: string; image_url: string }) => ({
                        uiId: v.uiId,
                        image_url: v.image_url,
                    })),
                ).toEqual([
                    { uiId: "blue", image_url: "https://media.test/blue" },
                    { uiId: "red", image_url: "https://media.test/red" },
                ]);
                expect(result.attributesImageSignedUrls).toEqual({});
            }
            if (mode === "不完全な新規色画像") {
                expect(saved.attributes.colorVariants[0].image_url).toBeUndefined();
                expect(result.attributesImageSignedUrls).toEqual({});
            }
            if (mode === "一部商品画像欠落") {
                expect(saved.first_image_url).toBe(item.image_url[1]);
                expect(mocks.updateItemDraftImage.mock.calls[0][0].urls).toEqual([
                    item.image_url[1],
                    "https://media.test/item-image/7/11_2_1000_request-a",
                ]);
                expect(result.itemImageSignedUrls).toEqual([{ index: 2, url: "signed-image" }]);
            }
        } finally {
            now.mockRestore();
        }
    });
});

describe("P0/P1: F4のブランド保存境界と画像上限", () => {
    it.each([254, 255, 256])("AF-V02: 新規ブランド%s文字は保存前に上限判定", async (length) => {
        byName("名".repeat(length));
        if (length <= 255) {
            await run();
            expect(mocks.createAliases).toHaveBeenCalledOnce();
            expect(mocks.CreateItemDraft.mock.calls[0][0].data.brand_aliases_id).toBe(71);
        } else {
            await expectAppError(run(), "BRAND_NAME_TOO_LONG");
            expect(mocks.createAliases).not.toHaveBeenCalled();
            expect(mocks.CreateItemDraft).not.toHaveBeenCalled();
            expect(mocks.updateItemDraftImage).not.toHaveBeenCalled();
        }
    });
    it.each([254, 255, 256])("AF-V02: NFKCで正規化後%s文字になる名前を保存前に検証", async (length) => {
        const input = "㍿".repeat(63) + "名".repeat(length - 252);
        const normalized = "株式会社".repeat(63) + "名".repeat(length - 252);
        byName(input);
        if (length <= 255) {
            await run();
            expect(mocks.createAliases).toHaveBeenCalledExactlyOnceWith({ inputName: input, normalized, transaction });
        } else {
            await expectAppError(run(), "BRAND_NAME_TOO_LONG");
            expect(mocks.createAliases).not.toHaveBeenCalled();
            expect(mocks.CreateItemDraft).not.toHaveBeenCalled();
            expect(mocks.updateItemDraftImage).not.toHaveBeenCalled();
        }
    });
    it.each(["指定ID", "紐付alias", "名前brand", "未紐付alias"])(
        "AF-V02: %sで既存解決できる表示名は長くても新規保存しない",
        async (mode) => {
            byName("名".repeat(256));
            if (mode === "指定ID") {
                body.brand.id = "61";
                mocks.getBrand.mockResolvedValue(brand);
            }
            if (mode === "紐付alias") mocks.getAliasOne.mockResolvedValue({ id: 71, brand });
            if (mode === "名前brand") mocks.getBrandOne.mockResolvedValue(brand);
            if (mode === "未紐付alias") mocks.getAliasOne.mockResolvedValue({ id: 71, brand: null });
            await run();
            expect(mocks.createAliases).not.toHaveBeenCalled();
            expect(mocks.CreateItemDraft).toHaveBeenCalledOnce();
        },
    );
    it.each([10, 11])("AF-IMG01: 入力11枚・確定%s枚の上限を実helper経由で検証", async (count) => {
        body.itemImages = Array.from({ length: 11 }, (_, i) => ({
            name: `画像${i}`,
            type: i < count ? "image/png" : null,
            uploaded: false,
        }));
        if (count === 10) {
            await run();
            expect(mocks.updateItemDraftImage.mock.calls[0][0].urls).toHaveLength(10);
        } else {
            await expectAppError(run(), "ITEM_IMAGE_LIMIT_EXCEEDED");
            noMasterOrWrites();
        }
    });
    describe.each(numberTargets)("AF-I02: %s.%sの未選択", (group, key, output) => {
        it.each([null, "", " ", "\t\n"])("値%sを実usecaseの保存へnullとして渡す", async (value) => {
            Object.assign(body[group], { [key]: value });
            if (output === "brandId") body.brand.name = null;
            await run();
            const column = {
                categoryId: "category_id",
                conditionId: "item_condition_id",
                dayId: "shipping_day_id",
                serviceId: "shipping_service_id",
                placeId: "shipping_place_id",
                brandId: "brand_id",
            }[output];
            expect(mocks.CreateItemDraft.mock.calls[0][0].data[column]).toBeNull();
        });
    });
});
