import type { Transaction } from "sequelize";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { createItemEditingCopy } from "../../../../services/itemEditing/command.js";
import type { GetMyItemWithVideoSaleShippingParams, ItemWithVideoSaleShipping } from "../../../../types/serviceType/items.js";
import {
    deferred, editingResult, expectedData, expectAppError, makeItem, nullableItemKeys,
    shippingKeys, sourceResult, transactionFixture, videoKeys,
} from "./fixtures.js";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn<(callback: (transaction: Transaction) => Promise<number>) => Promise<number>>(),
    get: vi.fn<(params: GetMyItemWithVideoSaleShippingParams) => Promise<ItemWithVideoSaleShipping | null>>(),
    create: vi.fn<typeof createItemEditingCopy>(),
}));
vi.mock("../../../../db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../../services/items/index.js", () => ({ getMyItemWithVideoSaleShipping: mocks.get }));
vi.mock("../../../../services/itemEditing/command.js", () => ({ createItemEditingCopy: mocks.create }));
import { createItemEditingCopyUseCase } from "../createItemEditingCopy.js";

let item: ReturnType<typeof makeItem>;
let transaction: Transaction;
let events: string[];
const run = () => createItemEditingCopyUseCase({ userId: 7, itemId: 101 });
const data = () => mocks.create.mock.calls[0][0].data;
beforeEach(() => {
    vi.resetAllMocks();
    item = makeItem();
    transaction = transactionFixture();
    events = [];
    mocks.transaction.mockImplementation(async (callback) => {
        events.push("begin");
        const result = await callback(transaction);
        events.push("complete");
        return result;
    });
    mocks.get.mockImplementation(async () => { events.push("get"); return sourceResult(item); });
    mocks.create.mockImplementation(async () => { events.push("create"); return editingResult(); });
});
afterEach(() => vi.restoreAllMocks());

describe("P0 正常コピー・全引渡し項目", () => {
    it("N01 N02 N03 T01: 同一transactionで取得・作成し全コピー値と新規IDを返す", async () => {
        const before = structuredClone(item);
        expect(await run()).toBe(456);
        expect(events).toEqual(["begin", "get", "create", "complete"]);
        expect(mocks.transaction).toHaveBeenCalledTimes(1);
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemId: 101, userId: 7, transaction });
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ data: expectedData(), transaction });
        expect(mocks.get.mock.calls[0][0].transaction).toBe(transaction);
        expect(mocks.create.mock.calls[0][0].transaction).toBe(transaction);
        expect(item).toEqual(before);
    });
    it.each(nullableItemKeys)("N05: nullable商品項目%sのnullを保持する", async (key) => {
        item[key] = null;
        await run();
        expect(data()).toEqual({ ...expectedData(), [key]: null });
    });
    it.each(videoKeys.flatMap((key) => [null, undefined].map((absent) => ({ key, absent }))))(
        "N05: Video.$key=$absentをnullへ対応付ける", async ({ key, absent }) => {
        // undefinedは取得serviceの境界で欠落値を模擬する。
        Reflect.set(item.Video!, key, absent);
        await run();
        expect(data()).toEqual({ ...expectedData(), [key === "status" ? "video_status" : key]: null });
    });
    it.each(shippingKeys.flatMap((key) => [null, undefined].map((absent) => ({ key, absent }))))(
        "N05 B03: 配送$key=$absentをnullへ対応付ける", async ({ key, absent }) => {
        Reflect.set(item.ItemShippingProfile!, key, absent);
        await run();
        expect(data()).toEqual({ ...expectedData(), [key]: null });
    });
    describe.each([null, undefined])("N04: 関連なし=%s", (absent) => {
        it.each(["Video", "Sale", "ItemShippingProfile", "all"] as const)("%sのみ／全関連欠落でも成功する", async (relation) => {
            const expected = expectedData();
            if (relation === "Video" || relation === "all") {
                item.Video = absent;
                for (const key of videoKeys) expected[key === "status" ? "video_status" : key] = null;
            }
            if (relation === "Sale" || relation === "all") {
                item.Sale = absent;
                expected.before_price = null;
                expected.price = null;
            }
            if (relation === "ItemShippingProfile" || relation === "all") {
                item.ItemShippingProfile = absent;
                for (const key of shippingKeys) expected[key] = null;
            }
            expect(await run()).toBe(456);
            expect(data()).toEqual(expected);
        });
    });
    it("N06: 空文字・0・falseをnullやdefaultへ変換しない", async () => {
        item.detail = ""; item.recommend = false;
        item.Video!.title = ""; item.Video!.summary = ""; item.Video!.duration = 0;
        item.Sale!.before_price = 0; item.ItemShippingProfile!.shipping_service_free_text = "";
        await run();
        expect(data()).toEqual({
            ...expectedData(), detail: "", recommend: false, title: "", summary: "", duration: 0,
            before_price: 0, price: 0, shipping_service_free_text: "",
        });
    });
    it.each([null, undefined])("N07: Sale.before_price=%sならItem.priceへfallbackしない", async (absent) => {
        Reflect.set(item.Sale!, "before_price", absent);
        await run();
        expect(data()).toEqual({ ...expectedData(), before_price: null, price: null });
    });
    it.each([true, false, null])("N08: recommend=%sを保持する", async (recommend) => {
        item.recommend = recommend; await run(); expect(data().recommend).toBe(recommend);
    });
    it.each(["men", "women", "unisex"] as const)("N08: gender=%sを保持する", async (gender) => {
        item.gender_type = gender; await run(); expect(data().gender_type).toBe(gender);
    });
    it.each(["adult", "kids", "both"] as const)("N08: age=%sを保持する", async (age) => {
        item.age_type = age; await run(); expect(data().age_type).toBe(age);
    });
    it.each([null, [], ["one"], Array.from({ length: 10 }, (_, i) => "image-" + i)].map((images) => ({ images })))(
        "N09: image_url=$imagesと独立した先頭URLを保持する", async ({ images }) => {
            item.image_url = images; await run();
            expect(data().image_url).toEqual(images);
            expect(data().first_image_url).toBe(item.first_image_url);
        },
    );
    it("N10: 元ID・日時・関連ID・商品状態を作成dataに含めない", async () => {
        await run();
        for (const key of ["id", "createdAt", "updatedAt", "status", "video_id", "sale_id", "shipping_id", "views_count"]) {
            expect(data()).not.toHaveProperty(key);
        }
        expect(data()).not.toHaveProperty("item_id");
    });
    describe.each([null, "", "processing", "ready"])("N11: video_status=%s", (status) => {
        it.each([null, "https://media.test/converted"])("converted_url=%sで再変換しない", async (converted) => {
            item.Video!.status = status; item.Video!.converted_url = converted; await run();
            expect(data().video_status).toBe(status); expect(data().converted_url).toBe(converted);
        });
    });
    it.each([0, 254, 255])("B01: name/title/free_text/video_statusの%s文字を保持する", async (length) => {
        const value = "あ".repeat(length);
        item.name = value; item.Video!.title = value; item.Video!.status = value;
        item.ItemShippingProfile!.shipping_service_free_text = value;
        await run();
        expect(data()).toEqual({
            ...expectedData(), name: value, title: value, video_status: value, shipping_service_free_text: value,
        });
    });
    it("B02: 長い日本語・改行のTEXT値を保持する", async () => {
        const value = "日本語\n".repeat(1000);
        item.detail = value; item.Video!.summary = value; item.Video!.original_url = value;
        await run();
        expect(data()).toEqual({ ...expectedData(), detail: value, summary: value, original_url: value });
    });
    it("Q01: 同じ入力を逐次実行して異なる新規IDを返す", async () => {
        mocks.create.mockResolvedValueOnce(editingResult(456)).mockResolvedValueOnce(editingResult(789));
        expect(await run()).toBe(456); expect(await run()).toBe(789);
        expect(mocks.get).toHaveBeenCalledTimes(2); expect(mocks.create).toHaveBeenCalledTimes(2);
    });
    it("O05 AF-DEL01: 取得serviceが論理削除済み商品をnullで除外すると404", async () => {
        mocks.get.mockResolvedValue(null);
        await expectAppError(run());
        expect(mocks.create).not.toHaveBeenCalled();
    });
});

describe("P0 異常時の打切り", () => {
    it.each(["不在", "他ユーザー", "seller_id=null"])("E01: %sをserviceがnullで除外すると404", async () => {
        mocks.get.mockResolvedValue(null);
        await expectAppError(run());
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each(["soldout", null, undefined, "unknown"])("E02 E03: status=%sは404で作成しない", async (status) => {
        // null/undefined/unknownは現行ENUMの外側を模擬する防御入力。
        mocks.get.mockResolvedValue({ ...sourceResult(item), status } as ItemWithVideoSaleShipping);
        await expectAppError(run()); expect(mocks.create).not.toHaveBeenCalled();
    });
    it("E04: transaction開始失敗では取得も作成もしない", async () => {
        const error = new Error("begin");
        mocks.transaction.mockRejectedValue(error);
        await expect(run()).rejects.toBe(error);
        expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each(["lock", "reload"])("E05 E06: 取得%s失敗をそのまま伝播する", async (step) => {
        const error = new Error(step);
        mocks.get.mockRejectedValue(error);
        await expect(run()).rejects.toBe(error);
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it("E07: 作成失敗ではIDを返さず例外を伝播する", async () => {
        const error = new Error("create"); mocks.create.mockRejectedValue(error);
        await expect(run()).rejects.toBe(error); expect(events).not.toContain("complete");
    });
    it("E08 O04: callback後の完了失敗を伝播し成功IDを返さない", async () => {
        const error = new Error("transaction completion");
        mocks.transaction.mockImplementation(async (callback) => { await callback(transaction); throw error; });
        await expect(run()).rejects.toBe(error);
        expect(mocks.create).toHaveBeenCalledTimes(1);
        // COMMIT通信断や実rollbackの成否は、このモックでは保証しない。
    });
    it.each(["null", "soldout"])("E09: %sが破損属性の変換より先に拒否される", async (mode) => {
        item.status = "soldout";
        item.attributes = null as unknown as typeof item.attributes;
        mocks.get.mockResolvedValue(mode === "null" ? null : sourceResult(item));
        await expectAppError(run()); expect(mocks.create).not.toHaveBeenCalled();
    });
});

describe("P0 非同期の待機", () => {
    it("A01: 取得完了まで作成・成功返却へ進まない", async () => {
        const gate = deferred<ItemWithVideoSaleShipping | null>();
        mocks.get.mockReturnValue(gate.promise);
        let done = false;
        const pending = run().finally(() => { done = true; });
        try {
            expect(mocks.get).toHaveBeenCalledOnce();
            expect(mocks.create).not.toHaveBeenCalled(); expect(done).toBe(false);
        } finally { gate.resolve(sourceResult(item)); await pending; }
        expect(await pending).toBe(456);
    });
    it.each(["resolve", "reject"])("A02: 作成の%s完了までcallbackを完了しない", async (mode) => {
        const gate = deferred<ReturnType<typeof editingResult>>();
        const entered = deferred<void>();
        const error = new Error("delayed create");
        mocks.create.mockImplementation(() => { entered.resolve(); return gate.promise; });
        let done = false;
        const pending = run().finally(() => { done = true; });
        const assertion = mode === "reject" ? expect(pending).rejects.toBe(error) : expect(pending).resolves.toBe(456);
        try {
            await entered.promise;
            expect(done).toBe(false); expect(events).not.toContain("complete");
        } finally {
            if (mode === "reject") gate.reject(error); else gate.resolve(editingResult());
            await assertion;
        }
    });
    it("A03: callbackがIDを返してもtransactionの完了までresolveしない", async () => {
        const entered = deferred<void>(), release = deferred<void>();
        mocks.transaction.mockImplementation(async (callback) => {
            const id = await callback(transaction); entered.resolve(); await release.promise; return id;
        });
        let done = false;
        const pending = run().finally(() => { done = true; });
        try { await entered.promise; expect(done).toBe(false); }
        finally { release.resolve(); await pending; }
        expect(await pending).toBe(456);
    });
});
