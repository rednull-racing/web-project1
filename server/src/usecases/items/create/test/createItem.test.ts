import { mocks, setup, transaction } from "../../../../../test/fixtures/items/createItem/usecaseMocks.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    deferred,
    expectedAttributes,
    idFields,
    requiredIdFields,
    nullableBrandCases,
    freezeDeep,
} from "../../../../../test/fixtures/items/createItem/fixtures.js";
import { AppError } from "../../../../errors.js";
import { createItemUseCase } from "../createItem.js";
vi.mock("../../../shared/validateMaster.js", () => ({ validateMaster: mocks.validateMaster }));
let editing: ReturnType<typeof setup>;
const run = () => createItemUseCase({ userId: 7, itemEditingId: 11 });
beforeEach(() => {
    editing = setup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
const error = async (code: string, statusCode: number) => {
    const result = await run().catch((e: unknown) => e);
    expect(result).toBeInstanceOf(AppError);
    expect(result).toMatchObject({ code, statusCode });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.validateMaster).not.toHaveBeenCalled();
    for (const key of [
        "countFollower",
        "countSellItem",
        "createVideo",
        "createSale",
        "createShipping",
        "createItem",
        "deleteItemEditing",
        "createNotification",
    ] as const)
        expect(mocks[key]).not.toHaveBeenCalled();
};
describe("P0 正常公開・コピー・算出・通知", () => {
    it("N01 N02 N09 N11 N12 B01 T01 T11: 全コピーと新規採番・順序・同一transaction", async () => {
        expect(await run()).toBe(456);
        expect(mocks.getMyItemEditing).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: 11, transaction });
        expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith({
            userId: 7,
            attributes: ["id", "user_name", "user_introduction", "penalty_points"],
            transaction,
        });
        expect(mocks.validateMaster).toHaveBeenCalledExactlyOnceWith({
            categoryId: 21,
            conditionId: 22,
            dayId: 23,
            serviceId: 24,
            placeId: 25,
            transaction,
        });
        expect(mocks.getCategories).toHaveBeenCalledExactlyOnceWith({ categoryId: 28, transaction });
        for (const key of ["countFollower", "countSellItem"] as const)
            expect(mocks[key]).toHaveBeenCalledExactlyOnceWith({ userId: 7, transaction });
        expect(mocks.createVideo).toHaveBeenCalledExactlyOnceWith({
            data: {
                thumbnail_url: editing.thumbnail_url,
                title: editing.title,
                summary: editing.summary,
                duration: 30,
                play_count: 0,
                original_url: editing.original_url,
                converted_url: editing.converted_url,
                status: "ready",
            },
            transaction,
        });
        expect(mocks.createSale).toHaveBeenCalledExactlyOnceWith({
            data: { before_price: 15000, discount_rate: null, discount_amount: null, sale_flag: false },
            transaction,
        });
        expect(mocks.createShipping).toHaveBeenCalledExactlyOnceWith({
            data: {
                shipping_day_id: 23,
                shipping_service_id: 24,
                shipping_place_id: 25,
                shipping_service_free_text: "配送備考",
            },
            transaction,
        });
        expect(mocks.createItem).toHaveBeenCalledExactlyOnceWith({
            data: {
                name: editing.name,
                detail: "説明AB",
                image_url: editing.image_url,
                price: 12340,
                item_condition_id: 22,
                seller_id: 7,
                first_image_url: editing.first_image_url,
                gender_type: "unisex",
                age_type: "both",
                recommend: false,
                category_id: 21,
                brand_id: 26,
                brand_aliases_id: 27,
                attributes: expectedAttributes(),
                views_count: 0,
                sort_number: 6295,
                sort_buzz_number: 6295,
                search_text: "testかたかなvideoてすとしゃつtopsuser",
                video_id: 101,
                sale_id: 202,
                shipping_id: 303,
                status: "active",
                uploaded_at: new Date(),
                save_at: new Date(),
                early_sell: true,
                checked: false,
                report_score: 0,
            },
            transaction,
        });
        expect(mocks.deleteItemEditing).toHaveBeenCalledExactlyOnceWith({ itemEditing: editing, transaction });
        expect(mocks.deleteItemEditing.mock.calls[0][0].itemEditing).toBe(editing);
        const order = [
            mocks.createVideo,
            mocks.createSale,
            mocks.createShipping,
            mocks.createItem,
            mocks.deleteItemEditing,
            mocks.createNotification,
        ].map((fn) => fn.mock.invocationCallOrder[0]);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(mocks.createNotification).toHaveBeenCalledExactlyOnceWith({
            data: {
                read_user_id: 7,
                url: "/item/456",
                message_image: editing.first_image_url,
                type: "ITEM",
                message: `商品「${editing.name}」を出品いただき誠にありがとうございます。商品の詳細はこちらの商品ページからご確認ください。`,
            },
        });
    });
    it.each([4, 5, 6, "5", "6"])("N06: penalty=%sの5境界", async (penalty_points) => {
        mocks.getUser.mockResolvedValue({ user_name: "u", user_introduction: "紹介DE", penalty_points });
        await run();
        expect(mocks.createItem.mock.calls[0][0].data.sort_number).toBe(
            [6, "6"].includes(penalty_points) ? 1295 : 6295,
        );
    });
    it.each([
        [0, 0, 6245],
        [1, 0, 6255],
        [0, 1, 6255],
        [3, 4, 6315],
    ])("N07: follower=%s sell=%sでsort=%s", async (f, s, expected) => {
        mocks.countFollower.mockResolvedValue(f);
        mocks.countSellItem.mockResolvedValue(s);
        await run();
        expect(mocks.createItem.mock.calls[0][0].data.sort_number).toBe(expected);
    });
    it.each([null, "", "😀"])("N08: null/空/UTF16長 %sと小数sort", async (text) => {
        editing.price = 301;
        editing.detail = text;
        editing.summary = text;
        mocks.getUser.mockResolvedValue({ penalty_points: 6, user_introduction: text });
        await run();
        expect(mocks.createItem.mock.calls[0][0].data.sort_number).toBe(80.1 + (text?.length ?? 0) * 3);
    });
    it.each([null, 15000])("N03: before_price=%s保持し割引解除", async (value) => {
        editing.before_price = value;
        await run();
        expect(mocks.createSale.mock.calls[0][0].data).toEqual({
            before_price: value,
            discount_rate: null,
            discount_amount: null,
            sale_flag: false,
        });
    });
    it.each([
        "detail",
        "summary",
        "duration",
        "converted_url",
        "video_status",
        "recommend",
        "shipping_service_free_text",
    ] as const)("N04: %sのnullを保持", async (field) => {
        editing[field] = null;
        await run();
        const data = Object.assign(
            {},
            mocks.createItem.mock.calls[0][0].data,
            mocks.createVideo.mock.calls[0][0].data,
            mocks.createShipping.mock.calls[0][0].data,
        );
        expect(data[field === "video_status" ? "status" : field]).toBeNull();
    });
    it.each(["men", "women", "unisex"] as const)("N05: gender=%sを保持", async (value) => {
        editing.gender_type = value;
        await run();
        expect(mocks.createItem.mock.calls[0][0].data.gender_type).toBe(value);
    });
    it.each(["adult", "kids", "both"] as const)("N05: age=%sを保持", async (value) => {
        editing.age_type = value;
        await run();
        expect(mocks.createItem.mock.calls[0][0].data.age_type).toBe(value);
    });
    it.each([true, false])("N05: recommend=%sを保持", async (value) => {
        editing.recommend = value;
        await run();
        expect(mocks.createItem.mock.calls[0][0].data.recommend).toBe(value);
    });
    it.each([null, { parent_id: null, name: " シャツ " }])("N10: 親なし %j", async (parent) => {
        if (parent) mocks.validateMaster.mockResolvedValue(parent);
        else mocks.getCategories.mockResolvedValue(null);
        await run();
        if (parent) expect(mocks.getCategories).not.toHaveBeenCalled();
        expect(mocks.createItem.mock.calls[0][0].data.search_text).toBe("testかたかなvideoてすとしゃつuser");
    });
});
describe("P0 保存データと早期停止", () => {
    it("E01: 元行なしは404で後続なし", async () => {
        mocks.getMyItemEditing.mockResolvedValue(null);
        await error("ITEM_EDITING_NOT_FOUND", 404);
    });
    it.each([
        ["B02", "original_url", null, "VIDEO_URL_NULL"],
        ["B02", "original_url", "", "VIDEO_URL_NULL"],
        ["B03", "thumbnail_url", null, "THUMBNAIL_URL_NULL"],
        ["B03", "thumbnail_url", "", "THUMBNAIL_URL_NULL"],
        ["B04", "image_url", null, "ITEM_IMAGE_NULL"],
        ["B04", "image_url", [], "ITEM_IMAGE_NULL"],
        ["B04", "image_url", Array(11).fill("image"), "ITEM_IMAGE_LIMIT_EXCEEDED"],
        ...[null, 299, 1000001, 1.5, "300", NaN, Infinity].map((v) => ["B05", "price", v, "ITEM_PUBLISH_DATA_INVALID"]),
        ...["name", "title"].flatMap((f) => [null, "", 1, {}].map((v) => ["B06", f, v, "ITEM_PUBLISH_DATA_INVALID"])),
        ...[null, ""].map((v) => ["B07", "first_image_url", v, "ITEM_PUBLISH_DATA_INVALID"]),
    ])("%s: %s=%jを拒否", async (_id, field, value, code) => {
        Object.assign(editing, { [String(field)]: value });
        await error(String(code), 400);
    });
    it.each(
        idFields.flatMap((field) =>
            [null, 0, -1, 2147483648, 1.5, "1", undefined, NaN, Infinity]
                .filter((value) => value !== null || !["brand_id", "brand_aliases_id"].includes(field))
                .map((value) => ({ field, value, label: String(value) })),
        ),
    )("B09 AF-ID01: $field=$labelを拒否", async ({ field, value }) => {
        Object.assign(editing, { [field]: value });
        await error("INVALID_NUMBER", 400);
    });
    it("AF-ID01: 全ID nullを拒否", async () => {
        for (const field of idFields) editing[field] = null;
        await error("INVALID_NUMBER", 400);
    });
    it.each(idFields.flatMap((field) => [1, 2147483647].map((value) => ({ field, value }))))(
        "B08: $field=$valueを受理",
        async ({ field, value }) => {
            editing[field] = value;
            expect(await run()).toBe(456);
        },
    );
    it.each([300, 1000000])("B05: 価格境界%sを受理", async (value) => {
        editing.price = value;
        expect(await run()).toBe(456);
    });
    it.each([1, 10])("B04: 画像%s枚を受理", async (length) => {
        editing.image_url = Array.from({ length }, (_, i) => `https://media.test/${i}`);
        expect(await run()).toBe(456);
    });
    it.each([
        [{ original_url: null, thumbnail_url: null }, "VIDEO_URL_NULL"],
        [{ thumbnail_url: null, image_url: [] }, "THUMBNAIL_URL_NULL"],
        [{ image_url: [], category_id: null }, "ITEM_IMAGE_NULL"],
        [{ image_url: Array(11).fill("i"), category_id: 0 }, "ITEM_IMAGE_LIMIT_EXCEEDED"],
        [{ category_id: null, price: 1 }, "INVALID_NUMBER"],
        [{ price: 1, attributes: null }, "ITEM_PUBLISH_DATA_INVALID"],
    ])("B10: 複数不備%jで%sを優先", async (patch, code) => {
        Object.assign(editing, patch);
        await error(code, 400);
    });
    it("M05: userなしは500でmaster以降なし", async () => {
        mocks.getUser.mockResolvedValue(null);
        await expect(run()).rejects.toMatchObject({ code: "USER_NOT_FOUND", statusCode: 500 });
        expect(mocks.validateMaster).not.toHaveBeenCalled();
        expect(mocks.createNotification).not.toHaveBeenCalled();
    });
});
describe("P0 T02〜T08 T13 依存失敗と待機", () => {
    const steps = [
        "getMyItemEditing",
        "getUser",
        "validateMaster",
        "getCategories",
        "countFollower",
        "countSellItem",
        "createVideo",
        "createSale",
        "createShipping",
        "createItem",
        "deleteItemEditing",
    ] as const;
    it.each(steps)("T05 T06 T07: %s失敗は同一Error・後続停止", async (key) => {
        const failure = new Error("internal SQL marker");
        mocks[key].mockRejectedValue(failure);
        await expect(run()).rejects.toBe(failure);
        for (const later of steps.slice(steps.indexOf(key) + 1)) expect(mocks[later]).not.toHaveBeenCalled();
        expect(mocks.createNotification).not.toHaveBeenCalled();
    });
    it.each(steps)("T02: %s完了まで後続と成功を保留", async (key) => {
        const entered = deferred<void>();
        const gate = deferred<unknown>();
        const result = mocks[key].getMockImplementation()!;
        const standard = await result();
        mocks[key].mockImplementation(() => {
            entered.resolve();
            return gate.promise;
        });
        let done = false;
        const pending = run().finally(() => {
            done = true;
        });
        try {
            await entered.promise;
            expect(done).toBe(false);
            for (const later of steps.slice(steps.indexOf(key) + 1)) expect(mocks[later]).not.toHaveBeenCalled();
            expect(mocks.createNotification).not.toHaveBeenCalled();
        } finally {
            gate.resolve(standard);
            await pending;
        }
    });
    it.each([false, true])("T03 T08: callback後の外側transaction resolve=%s", async (success) => {
        const entered = deferred<void>();
        const gate = deferred<void>();
        const failure = new Error("commit result unknown");
        mocks.transaction.mockImplementation(async (callback) => {
            const value = await callback(transaction);
            entered.resolve();
            await gate.promise;
            if (!success) throw failure;
            return value;
        });
        const pending = run();
        const assertion = success ? expect(pending).resolves.toBe(456) : expect(pending).rejects.toBe(failure);
        try {
            await entered.promise;
            expect(mocks.createNotification).not.toHaveBeenCalled();
        } finally {
            gate.resolve();
            await assertion;
        }
    });
    it("T04: transaction開始失敗では取得も通知もない", async () => {
        const failure = new Error("start");
        mocks.transaction.mockRejectedValue(failure);
        await expect(run()).rejects.toBe(failure);
        expect(mocks.getMyItemEditing).not.toHaveBeenCalled();
        expect(mocks.createNotification).not.toHaveBeenCalled();
    });
    it.each([false, true])("T12: 通知未完了でも成功、reject=%sを捕捉", async (reject) => {
        const gate = deferred<void>();
        mocks.createNotification.mockReturnValue(gate.promise);
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            expect(await run()).toBe(456);
            expect(mocks.deleteItemEditing).toHaveBeenCalledTimes(1);
        } finally {
            if (reject) gate.reject(new Error("notify"));
            else gate.resolve();
            await gate.promise.catch(() => {});
        }
        expect(log).toHaveBeenCalledTimes(reject ? 1 : 0);
    });
});
// resetInventoryは非exportのため公開usecase経由で実処理を検証する。
describe("P0 I 在庫構造・非破壊", () => {
    it("I01 I04 I12: 深いfreeze元を保持し全階層currentだけ初期化", async () => {
        const before = structuredClone(editing.attributes);
        freezeDeep(editing.attributes);
        await run();
        const copied = mocks.createItem.mock.calls[0][0].data.attributes;
        expect(copied).toEqual(expectedAttributes());
        expect(editing.attributes).toEqual(before);
        expect(copied).not.toBe(editing.attributes);
        expect(copied.colorVariants).not.toBe(editing.attributes.colorVariants);
        copied.colorVariants[0].sizes[0].inventory.initial = 123;
        copied.materials[0].name = "変更";
        copied.extra.values.push("変更");
        expect(editing.attributes).toEqual(before);
    });
    it.each([
        { input: {}, expected: {} },
        { input: { colorVariants: [] }, expected: { colorVariants: [] } },
        { input: { colorVariants: [{}] }, expected: { colorVariants: [{}] } },
        { input: { colorVariants: [{ sizes: [] }] }, expected: { colorVariants: [{ sizes: [] }] } },
        {
            input: { colorVariants: [{ sizes: [{ inventory: { initial: 1, current: 0, low_stock_ratio: 0.2 } }] }] },
            expected: { colorVariants: [{ sizes: [{ inventory: { initial: 1, current: 1, low_stock_ratio: 0.2 } }] }] },
        },
    ])("I03: 許容欠落$inputを補完しない", async ({ input, expected }) => {
        Object.assign(editing, { attributes: input });
        await run();
        expect(mocks.createItem.mock.calls[0][0].data.attributes).toEqual(expected);
    });
    it.each([null, undefined, [], 1, "bad", true])("I05: attributes=%jは500", async (value) => {
        Object.assign(editing, { attributes: value });
        await error("ITEM_ATTRIBUTES_INVALID", 500);
    });
    const paths = ["product", "color", "size"] as const;
    const wrap = (path: (typeof paths)[number], inventory: unknown) =>
        path === "product"
            ? { inventory }
            : path === "color"
              ? { colorVariants: [{ inventory }] }
              : { colorVariants: [{ sizes: [{ inventory }] }] };
    it.each(paths.flatMap((path) => [null, [], 1, "bad"].map((value) => ({ path, value }))))(
        "I08: $path inventory=$valueは500",
        async ({ path, value }) => {
            Object.assign(editing, { attributes: wrap(path, value) });
            await error("ITEM_ATTRIBUTES_INVALID", 500);
        },
    );
    it.each(
        paths.flatMap((path) =>
            ["initial", "current", "low_stock_ratio"].flatMap((key) =>
                [undefined, null, "1", true, NaN, Infinity, -Infinity].map((value) => ({ path, key, value })),
            ),
        ),
    )("I09: $path.$key=$valueは500", async ({ path, key, value }) => {
        const inventory = { initial: 1, current: 0, low_stock_ratio: 0.2, [key]: value };
        Object.assign(editing, { attributes: wrap(path, inventory) });
        const before = structuredClone(editing.attributes);
        await error("ITEM_ATTRIBUTES_INVALID", 500);
        expect(editing.attributes).toEqual(before);
    });
    it.each(paths.flatMap((path) => [-1, 0.5].map((value) => ({ path, value }))))(
        "I10: $path initial=$valueは400",
        async ({ path, value }) => {
            Object.assign(editing, { attributes: wrap(path, { initial: value, current: 0, low_stock_ratio: 0.2 }) });
            await error("ITEM_PUBLISH_DATA_INVALID", 400);
        },
    );
    it.each(
        paths.flatMap((path) =>
            [0, 1, 9].flatMap((initial) => [0, 1, 12].map((current) => ({ path, initial, current }))),
        ),
    )("I02: $path initial=$initial current=$current", async ({ path, initial, current }) => {
        Object.assign(editing, { attributes: wrap(path, { initial, current, low_stock_ratio: 0.2 }) });
        await run();
        expect(mocks.createItem.mock.calls[0][0].data.attributes).toEqual(
            wrap(path, { initial, current: initial, low_stock_ratio: 0.2 }),
        );
    });
    it.each([null, "bad", {}, 1].flatMap((value) => [{ colorVariants: value }, { colorVariants: [{ sizes: value }] }]))(
        "I06: 階層%jは500",
        async (value) => {
            Object.assign(editing, { attributes: value });
            await error("ITEM_ATTRIBUTES_INVALID", 500);
        },
    );
    it.each(
        [null, [], 1, "bad", true].flatMap((value) => [
            { colorVariants: [{}, value] },
            { colorVariants: [{ sizes: [{ inventory: { initial: 1, current: 0, low_stock_ratio: 0.2 } }, value] }] },
        ]),
    )("I07: 後方要素%jは500", async (value) => {
        Object.assign(editing, { attributes: value });
        await error("ITEM_ATTRIBUTES_INVALID", 500);
    });
    it("I08 I11: initial不正より後方サイズのinventory欠落を先に検出", async () => {
        Object.assign(editing, {
            attributes: {
                inventory: { initial: -1, current: 0, low_stock_ratio: 0.2 },
                colorVariants: [{ sizes: [{}] }],
            },
        });
        await error("ITEM_ATTRIBUTES_INVALID", 500);
    });
    it.each([-3, 0.5, 4])("O02: 有限current/ratio=%sは受理する観測", async (value) => {
        Object.assign(editing, { attributes: { inventory: { initial: 1, current: value, low_stock_ratio: value } } });
        await run();
        expect(mocks.createItem.mock.calls[0][0].data.attributes.inventory).toEqual({
            initial: 1,
            current: 1,
            low_stock_ratio: value,
        });
    });
    it.each(["   "])("O01: 空白=%jを受理する観測（trimは行わない）", async (value) => {
        editing.name = value;
        editing.title = value;
        expect(await run()).toBe(456);
    });
});
describe("O 観測値・非JSONの防御入力", () => {
    it.each([
        { original_url: " ", thumbnail_url: " ", first_image_url: " ", image_url: [""] },
        { first_image_url: "https://media.test/different", image_url: ["same", "same"] },
    ])("O01: URL/画像の追加検証なし %j", async (patch) => {
        Object.assign(editing, patch);
        expect(await run()).toBe(456);
        expect(mocks.createItem.mock.calls[0][0].data.image_url).toEqual(patch.image_url);
    });
    it("O03: 動画変換未完了・ID組合せ再解決なしを観測", async () => {
        editing.converted_url = null;
        editing.video_status = null;
        editing.brand_aliases_id = 999;
        expect(await run()).toBe(456);
        expect(mocks.createVideo.mock.calls[0][0].data.converted_url).toBeNull();
        expect(mocks.createItem.mock.calls[0][0].data.brand_aliases_id).toBe(999);
    });
    it("O06: sparse colorVariantsは構造判定通過後にTypeError、後続なし", async () => {
        Object.assign(editing, { attributes: { colorVariants: Array(1) } });
        await expect(run()).rejects.toBeInstanceOf(TypeError);
        expect(mocks.getUser).not.toHaveBeenCalled();
        expect(mocks.createNotification).not.toHaveBeenCalled();
    });
    it("O06 I03: 明示undefinedの任意inventoryは保持", async () => {
        Object.assign(editing, { attributes: { inventory: undefined } });
        await run();
        expect(mocks.createItem.mock.calls[0][0].data.attributes).toEqual({ inventory: undefined });
    });
    it("O06: 非JSONのfunction追加属性はstructuredCloneが拒否", async () => {
        Object.assign(editing, { attributes: { extra: () => 1 } });
        await expect(run()).rejects.toMatchObject({ name: "DataCloneError" });
        expect(mocks.getUser).not.toHaveBeenCalled();
    });
    it("I08: size.inventoryのみ欠落は構造500", async () => {
        Object.assign(editing, { attributes: { colorVariants: [{ sizes: [{}] }] } });
        await error("ITEM_ATTRIBUTES_INVALID", 500);
    });
});
describe("補完した独立条件", () => {
    it.each(
        ["detail", "summary", "user_introduction"].flatMap((field) =>
            [null, "", "😀"].map((value) => ({ field, value })),
        ),
    )("N08: $fieldのみ$valueに変更しUTF16長を加算", async ({ field, value }) => {
        editing.price = 301;
        const user = { user_name: "u", user_introduction: "紹介DE", penalty_points: 6 };
        if (field === "user_introduction") Object.assign(user, { user_introduction: value });
        else Object.assign(editing, { [field]: value });
        mocks.getUser.mockResolvedValue(user);
        await run();
        const lengths = { detail: 4, summary: 3, user_introduction: 4, [field]: value?.length ?? 0 };
        expect(mocks.createItem.mock.calls[0][0].data.sort_number).toBe(
            30.1 + lengths.detail + lengths.summary + lengths.user_introduction + 50,
        );
    });
    it.each([true, false])("N03: 元sale_flag=%s・割引値なしでもリセット", async (sale_flag) => {
        editing.sale_flag = sale_flag;
        editing.discount_rate = null;
        editing.discount_amount = null;
        await run();
        expect(mocks.createSale.mock.calls[0][0].data).toEqual({
            before_price: 15000,
            discount_rate: null,
            discount_amount: null,
            sale_flag: false,
        });
    });
    it("I12: 逆順・重複uiIdを維持し元inventoryに対応", async () => {
        const attributes = expectedAttributes();
        attributes.colorVariants.reverse();
        attributes.colorVariants[0].uiId = attributes.colorVariants[1].uiId;
        attributes.colorVariants[0].inventory.current = 0;
        Object.assign(editing, { attributes });
        await run();
        const result = mocks.createItem.mock.calls[0][0].data.attributes;
        expect(result.colorVariants.map((c: { uiId: string }) => c.uiId)).toEqual(["red", "red"]);
        expect(
            result.colorVariants.map(
                (c: {
                    inventory: {
                        current: number;
                    };
                }) => c.inventory.current,
            ),
        ).toEqual([2, 5]);
    });
    it.each(["initial", "current", "low_stock_ratio"])("I09: inventory.%sのキー欠落も500", async (key) => {
        const inventory: Record<string, unknown> = { initial: 1, current: 0, low_stock_ratio: 0.2 };
        delete inventory[key];
        Object.assign(editing, { attributes: { inventory } });
        await error("ITEM_ATTRIBUTES_INVALID", 500);
    });
});

describe("AF-BR 確定仕様: brand/aliasのnull許容", () => {
    it.each(nullableBrandCases)("AF-BR01: %jのnullを補完せず公開", async (patch) => {
        Object.assign(editing, patch);
        expect(await run()).toBe(456);
        const data = mocks.createItem.mock.calls[0][0].data;
        expect(data.brand_id).toBe(editing.brand_id);
        expect(data.brand_aliases_id).toBe(editing.brand_aliases_id);
        expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    });
});
describe("AF-BR01: 任意IDと必須IDの独立した検証", () => {
    const brandFields = ["brand_id", "brand_aliases_id"] as const;
    it.each(
        brandFields.flatMap((nullField) =>
            [0, -1, 2147483648, 1.5, "1", undefined, NaN, Infinity, -Infinity].map((value) => ({
                nullField,
                invalidField: nullField === "brand_id" ? "brand_aliases_id" : "brand_id",
                value,
                label: String(value),
            })),
        ),
    )("AF-BR01 B09: $nullField=nullでも$invalidField=$labelは拒否", async ({ nullField, invalidField, value }) => {
        Object.assign(editing, { [nullField]: null, [invalidField]: value });
        await error("INVALID_NUMBER", 400);
    });
    it.each(
        brandFields.flatMap((nullField) =>
            [1, 2147483647].map((value) => ({
                nullField,
                otherField: nullField === "brand_id" ? "brand_aliases_id" : "brand_id",
                value,
            })),
        ),
    )("AF-BR01 B08: $nullField=nullと$otherField=$valueは受理", async ({ nullField, otherField, value }) => {
        Object.assign(editing, { [nullField]: null, [otherField]: value });
        expect(await run()).toBe(456);
        expect(mocks.createItem.mock.calls[0][0].data[nullField]).toBeNull();
        expect(mocks.createItem.mock.calls[0][0].data[otherField]).toBe(value);
    });
    it.each(requiredIdFields)("AF-BR01 AF-ID01: brand/alias両方nullでも%sのnullは拒否", async (field) => {
        Object.assign(editing, { brand_id: null, brand_aliases_id: null, [field]: null });
        await error("INVALID_NUMBER", 400);
    });
});
