import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, expectAppError, makeBody, makeItem } from "./fixtures.js";

const mocks = vi.hoisted(() => ({
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
import { validateNumber } from "../../../../src/usecases/itemEditing/shared/validateNumber.js";
import { validateMaster } from "../../../../src/usecases/itemEditing/shared/validateMaster.js";
import { resolveBrand } from "../../../../src/usecases/itemEditing/shared/resolveBrand.js";
import { updateItemEditingConfirmUseCase } from "../../../../src/usecases/itemEditing/updateConfirm.js";

let body: ReturnType<typeof makeBody>;
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
    mocks.getMyItemEditing.mockResolvedValue(makeItem());
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
    it("B01: IDが有効なら名前検索を行わない", async () => {
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
    describe.each([null, 999])("B02: brandId=%s", (brandId) => {
        it.each([null, ""])("名前%sなら未選択のまま返す", async (name) => {
            byName(name);
            expect(await resolveBrand({ brandId, body })).toEqual({ brand: null, alias: null });
            expect(mocks.getBrand).toHaveBeenCalledTimes(brandId === null ? 0 : 1);
            expect(mocks.getAliasOne).not.toHaveBeenCalled();
            expect(mocks.createAliases).not.toHaveBeenCalled();
        });
    });
    it("B03: brand付きaliasを採用しその後もブランド名検索を行う", async () => {
        byName();
        const alias = { id: 71, brand };
        mocks.getAliasOne.mockResolvedValue(alias);
        mocks.getBrandOne.mockResolvedValue(brand);
        expect(await resolveBrand({ brandId: null, body })).toEqual({ brand, alias });
        expect(mocks.getBrandOne).toHaveBeenCalledOnce();
        expect(mocks.createAliases).not.toHaveBeenCalled();
        expect(mocks.getAliasOne.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.getBrandOne.mock.invocationCallOrder[0],
        );
    });
    it.each([
        [" ＡＢc カタカナ ", "abcかたかな"],
        [" ﾃｽﾄ　Brand ", "てすとbrand"],
    ])("B04: %sを%sに正規化して検索・作成する", async (name, normalized) => {
        byName(name);
        await resolveBrand({ brandId: null, body });
        expect(mocks.getAliasOne).toHaveBeenCalledExactlyOnceWith({ normalized });
        expect(mocks.getBrandOne).toHaveBeenCalledExactlyOnceWith({ normalized });
        expect(mocks.createAliases).toHaveBeenCalledExactlyOnceWith({ inputName: name, normalized });
    });
    it("B05 O02: 名前でブランドが見つかっても戻り値へ採用されない現状を確認する", async () => {
        byName();
        mocks.getBrandOne.mockResolvedValue(brand);
        await run();
        expect(mocks.updateConfirm.mock.calls[0][0].data).toMatchObject({ brand_id: null, brand_aliases_id: null });
        expect(mocks.createAliases).not.toHaveBeenCalled();
    });
    it.each([
        ["", 0, 0],
        ["名", 1, 0],
        ["名前", 1, 1],
    ] as const)("B06 O02: 名前%sは検索%s回・別名作成%s回", async (name, search, create) => {
        byName(name);
        expect(await resolveBrand({ brandId: null, body })).toEqual({ brand: null, alias: null });
        expect(mocks.getAliasOne).toHaveBeenCalledTimes(search);
        expect(mocks.getBrandOne).toHaveBeenCalledTimes(search);
        expect(mocks.createAliases).toHaveBeenCalledTimes(create);
    });
    it.each([false, true])("B07 B08 O02: 既存aliasのbrand有無=%sでも名前未登録なら追加作成する", async (linked) => {
        byName();
        const alias = { id: 70, brand: linked ? brand : null };
        mocks.getAliasOne.mockResolvedValue(alias);
        expect(await resolveBrand({ brandId: null, body })).toEqual(
            linked ? { brand, alias } : { brand: null, alias: null },
        );
        expect(mocks.createAliases).toHaveBeenCalledOnce();
    });
    it.each([
        ["  ", ""],
        ["😀", "😀"],
    ])("B09: %sの元文字列lengthで作成を判断する", async (name, normalized) => {
        byName(name);
        await resolveBrand({ brandId: null, body });
        expect(mocks.createAliases).toHaveBeenCalledWith({ inputName: name, normalized });
    });
    it.each(["getBrand", "getAliasOne", "getBrandOne", "createAliases"] as const)(
        "B10 E11: %sの失敗を伝播しtransactionを開始しない",
        async (name) => {
            if (name !== "getBrand") byName();
            const error = new Error(name);
            mocks[name].mockRejectedValue(error);
            await expect(run()).rejects.toBe(error);
            noWrites();
            const steps = ["getBrand", "getAliasOne", "getBrandOne", "createAliases"] as const;
            for (const later of steps.slice(steps.indexOf(name) + 1)) expect(mocks[later]).not.toHaveBeenCalled();
        },
    );
    it("T05: 別名作成は商品transaction開始前で更新失敗から切り離されている（永続化未検証）", async () => {
        byName();
        const error = new Error("update failed");
        mocks.updateConfirm.mockRejectedValue(error);
        await expect(run()).rejects.toBe(error);
        expect(mocks.createAliases).toHaveBeenCalledExactlyOnceWith({
            inputName: "新ブランド",
            normalized: "新ぶらんど",
        });
        expect(mocks.createAliases.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.transaction.mock.invocationCallOrder[0],
        );
        expect(mocks.updateItemEditingImage).not.toHaveBeenCalled();
    });
    it("Q03 O02: 同じ未登録名の逐次実行で別名作成が2回呼ばれる", async () => {
        byName();
        mocks.getAliasOne.mockResolvedValue({ id: 70, brand: null });
        await run();
        await run();
        expect(mocks.createAliases).toHaveBeenCalledTimes(2);
        for (const [args] of mocks.updateConfirm.mock.calls)
            expect(args.data).toMatchObject({ brand_id: null, brand_aliases_id: null });
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
