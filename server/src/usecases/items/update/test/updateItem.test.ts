import { mocks, setup, transaction } from "../../../../../test/fixtures/items/updateItem/usecaseMocks.js";
import { deferred, expectedAttributes, freezeDeep, idFields } from "../../../../../test/fixtures/items/updateItem/fixtures.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../errors.js";
import { updateItemUseCase } from "../updateItem.js";
vi.mock("../../../shared/validateMaster.js", () => ({ validateMaster: mocks.validateMaster }));
let editing: ReturnType<typeof setup>["editing"], target: ReturnType<typeof setup>["target"];
const run = () => updateItemUseCase({ userId: 7, itemEditingId: 11 });
const updates = ["updateVideo", "updateSale", "updateShipping", "updateItem", "deleteItemEditing", "createNotification"] as const;
beforeEach(() => {
    ({ editing, target } = setup());
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T01:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const reject = async (code: string, statusCode: number) => {
    const before = structuredClone(editing);
    const result = await run().catch((error: unknown) => error);
    expect(result).toBeInstanceOf(AppError);
    expect(result).toMatchObject({ code, statusCode });
    for (const key of updates) expect(mocks[key]).not.toHaveBeenCalled();
    expect(editing).toEqual(before);
};
describe("P0 全コピー・保持列境界と在庫", () => {
    it("N01 N02 N03: soldoutから同じ商品を更新し、全DTO・順序・tを維持", async () => {
        const before = structuredClone(editing.attributes);
        freezeDeep(editing.attributes);
        expect(await run()).toBe(456);
        expect(mocks.getMyItemEditing).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: 11, transaction });
        expect(mocks.getMyItemForUpdate).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemId: 456, transaction });
        expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith({ userId: 7, attributes: ["id", "user_name"], transaction });
        expect(mocks.validateMaster).toHaveBeenCalledExactlyOnceWith({ categoryId: 21, conditionId: 22, dayId: 23, serviceId: 24, placeId: 25, transaction });
        expect(mocks.getCategories).toHaveBeenCalledExactlyOnceWith({ categoryId: 28, transaction });
        expect(mocks.updateVideo).toHaveBeenCalledExactlyOnceWith({ video: target.video, data: {
            thumbnail_url: editing.thumbnail_url, title: editing.title, summary: "動画C", duration: 30,
            original_url: editing.original_url, converted_url: editing.converted_url, status: "ready",
        }, transaction });
        expect(mocks.updateSale).toHaveBeenCalledExactlyOnceWith({ sale: target.sale, data: {
            before_price: 15000, discount_rate: null, discount_amount: null, sale_flag: false,
        }, transaction });
        expect(mocks.updateShipping).toHaveBeenCalledExactlyOnceWith({ shipping: target.shipping, data: {
            shipping_day_id: 23, shipping_service_id: 24, shipping_place_id: 25, shipping_service_free_text: "配送備考",
        }, transaction });
        expect(mocks.updateItem).toHaveBeenCalledExactlyOnceWith({ item: target.item, data: {
            name: editing.name, detail: "説明AB", image_url: editing.image_url, price: 12340,
            item_condition_id: 22, first_image_url: editing.first_image_url, gender_type: "unisex", age_type: "both",
            recommend: false, category_id: 21, brand_id: 26, brand_aliases_id: 27, attributes: expectedAttributes(),
            search_text: "testかたかなvideoてすとしゃつtopsuser", status: "active", save_at: new Date(),
        }, transaction });
        expect(mocks.updateItem.mock.calls[0][0].item).toBe(target.item);
        expect(mocks.updateVideo.mock.calls[0][0].video).toBe(target.video);
        expect(mocks.deleteItemEditing).toHaveBeenCalledExactlyOnceWith({ itemEditing: editing, transaction });
        for (const key of updates.slice(0, -1)) expect(mocks[key].mock.calls[0][0].transaction).toBe(transaction);
        const order = updates.map(key => mocks[key].mock.invocationCallOrder[0]);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        const copied = mocks.updateItem.mock.calls[0][0].data.attributes;
        expect(copied).not.toBe(editing.attributes);
        expect(copied.colorVariants).not.toBe(editing.attributes.colorVariants);
        copied.colorVariants[0].sizes[0].inventory.initial = 99;
        copied.materials[0].name = "変更";
        expect(editing.attributes).toEqual(before);
        expect(mocks.createNotification).toHaveBeenCalledExactlyOnceWith({ data: {
            read_user_id: 7, url: "/item/456", message_image: editing.first_image_url, type: "ITEM",
            message: `商品「${editing.name}」が更新されました。商品の詳細はこちらの商品ページからご確認ください。`,
        } });
    });
    it.each(["active", "soldout"] as const)("N02: 更新前status=%sを制限せず復元後在庫0でsoldout", async status => {
        target.item.status = status;
        editing.attributes.inventory!.initial = 0;
        editing.attributes.inventory!.current = 99;
        await run();
        expect(mocks.updateItem.mock.calls[0][0].data.status).toBe("soldout");
        expect(mocks.updateItem.mock.calls[0][0].data.attributes.inventory.current).toBe(0);
    });
    it.each([1, 2, 2147483647])("N02: 商品initial=%sをactiveへ反映", async initial => {
        editing.attributes.inventory!.initial = initial;
        editing.attributes.inventory!.current = 0;
        await run();
        expect(mocks.updateItem.mock.calls[0][0].data.status).toBe("active");
    });
    it.each(["detail", "summary", "duration", "converted_url", "video_status", "recommend", "shipping_service_free_text", "before_price", "brand_id", "brand_aliases_id"] as const)("N01: %sのnullを保持", async field => {
        editing[field] = null;
        await run();
        const data = Object.assign({}, mocks.updateVideo.mock.calls[0][0].data, mocks.updateSale.mock.calls[0][0].data, mocks.updateShipping.mock.calls[0][0].data, mocks.updateItem.mock.calls[0][0].data);
        if (field === "video_status") expect(mocks.updateVideo.mock.calls[0][0].data.status).toBeNull();
        else expect(data[field]).toBeNull();
    });
    it.each(["親なし", "親欠落", "名前null"])("N03: %sのfallbackと検索正規化", async mode => {
        if (mode === "親なし") mocks.validateMaster.mockResolvedValue({ name: " シャツ ", parent_id: null });
        if (mode === "親欠落") mocks.getCategories.mockResolvedValue(null);
        if (mode === "名前null") mocks.getUser.mockResolvedValue({ user_name: null });
        await run();
        expect(mocks.updateItem.mock.calls[0][0].data.search_text).toBe(mode === "名前null" ? "testかたかなvideoてすとしゃつtops" : "testかたかなvideoてすとしゃつuser");
        if (mode === "親なし") expect(mocks.getCategories).not.toHaveBeenCalled();
    });
    it.each([{}, { colorVariants: [] }, { colorVariants: [{}] }, { colorVariants: [{ sizes: [] }] }])("N02: 任意色・サイズ欠落%jを補完しない", async patch => {
        const attributes = { inventory: { initial: 1, current: 0, low_stock_ratio: .2 }, ...patch };
        Object.assign(editing, { attributes });
        await run();
        expect(mocks.updateItem.mock.calls[0][0].data.attributes).toEqual({ ...attributes, inventory: { initial: 1, current: 1, low_stock_ratio: .2 } });
    });
    it("N01 E02: 空白name/titleと非URL文字列、動画未変換を再検証しない", async () => {
        Object.assign(editing, { name: " ", title: " ", original_url: "not-url", thumbnail_url: "not-url", first_image_url: "not-url", converted_url: null, video_status: null });
        expect(await run()).toBe(456);
    });
});
describe("P0 認可・状態・関連と保存値の拒否", () => {
    it("E01: セッションnullは404で商品取得なし", async () => {
        mocks.getMyItemEditing.mockResolvedValue(null);
        await reject("ITEM_EDITING_NOT_FOUND", 404);
        expect(mocks.getMyItemForUpdate).not.toHaveBeenCalled();
    });
    it.each([{ status: "normal" }, ...[null, 0, -1, 1.5, 2147483648, "456", undefined].map(item_id => ({ item_id }))])("E01: セッション%jは400・商品取得なし", async patch => {
        Object.assign(editing, patch);
        await reject("ITEM_EDITING_STATE_INVALID", 400);
        expect(mocks.getMyItemForUpdate).not.toHaveBeenCalled();
    });
    it("E01: 商品不存在・他人を表すnullで404", async () => {
        mocks.getMyItemForUpdate.mockResolvedValue(null);
        await reject("ITEM_NOT_FOUND", 404);
    });
    it.each(["video", "sale", "shipping"] as const)("E01: %s欠落は500で補完しない", async key => {
        target[key] = null;
        await reject("ITEM_RELATION_NOT_FOUND", 500);
        expect(mocks.getUser).not.toHaveBeenCalled();
    });
    it.each([
        ...["original_url", "thumbnail_url"].flatMap(field => [null, ""].map(value => ({ field, value, code: field === "original_url" ? "VIDEO_URL_NULL" : "THUMBNAIL_URL_NULL" }))),
        { field: "image_url", value: null, code: "ITEM_IMAGE_NULL" }, { field: "image_url", value: [], code: "ITEM_IMAGE_NULL" },
        { field: "image_url", value: Array(11).fill("i"), code: "ITEM_IMAGE_LIMIT_EXCEEDED" },
        ...[null, 299, 1000001, .5, "300", NaN, Infinity].map(value => ({ field: "price", value, code: "ITEM_PUBLISH_DATA_INVALID" })),
        ...["name", "title"].flatMap(field => [null, "", 1].map(value => ({ field, value, code: "ITEM_PUBLISH_DATA_INVALID" }))),
        ...[null, ""].map(value => ({ field: "first_image_url", value, code: "ITEM_PUBLISH_DATA_INVALID" })),
    ])("E02: $field=$valueを$codeで拒否", async ({ field, value, code }) => {
        Object.assign(editing, { [field]: value });
        // NaN/undefined等はHTTP JSONでは到達しない直接注入。
        await reject(code, 400);
        expect(mocks.getUser).not.toHaveBeenCalled();
    });
    it.each(idFields.flatMap(field => [null, 0, -1, 2147483648, .5, "1", undefined, NaN, Infinity].filter(value => value !== null || !["brand_id", "brand_aliases_id"].includes(field)).map(value => ({ field, value }))))("E02: $field=$valueをINVALID_NUMBER", async ({ field, value }) => {
        Object.assign(editing, { [field]: value });
        await reject("INVALID_NUMBER", 400);
        expect(mocks.getUser).not.toHaveBeenCalled();
    });
    it.each([300, 1000000])("E02: price境界%sを受理", async price => { editing.price = price; expect(await run()).toBe(456); });
    it.each([1, 10])("E02: 画像%s枚を受理", async count => { editing.image_url = Array(count).fill("url"); expect(await run()).toBe(456); });
    it("E02: 必須ID不備を名前/在庫不備より先に拒否", async () => {
        Object.assign(editing, { category_id: null, name: "", attributes: null });
        await reject("INVALID_NUMBER", 400);
    });
    it("E02: user欠落は500でmaster以降未実行", async () => {
        mocks.getUser.mockResolvedValue(null);
        await reject("USER_NOT_FOUND", 500);
        expect(mocks.validateMaster).not.toHaveBeenCalled();
    });
});
describe("P0 保存済みJSONB構造と非JSON直接注入", () => {
    const root = () => ({ initial: 1, current: 0, low_stock_ratio: .2 });
    const wrap = (path: string, inventory: unknown) => path === "商品" ? { inventory } : path === "色" ? { inventory: root(), colorVariants: [{ inventory }] } : { inventory: root(), colorVariants: [{ sizes: [{ inventory }] }] };
    it.each([null, undefined, [], 1, "bad", {}, { colorVariants: [] }])("E03: attributes=%jは500（商品inventory必須）", async attributes => {
        Object.assign(editing, { attributes }); await reject("ITEM_ATTRIBUTES_INVALID", 500);
    });
    it.each(["商品", "色", "サイズ"].flatMap(path => [null, [], "1", ...["initial", "current", "low_stock_ratio"].flatMap(key => [undefined, null, "1", NaN, Infinity].map(value => ({ initial: 1, current: 0, low_stock_ratio: .2, [key]: value })))].map(value => ({ path, value }))))("E03: $path inventory=$valueの構造不正500", async ({ path, value }) => {
        Object.assign(editing, { attributes: wrap(path, value) }); await reject("ITEM_ATTRIBUTES_INVALID", 500);
    });
    it.each(["商品", "色", "サイズ"].flatMap(path => [-1, .5].map(initial => ({ path, initial }))))("E03: $path initial=$initialは400", async ({ path, initial }) => {
        Object.assign(editing, { attributes: wrap(path, { ...root(), initial }) }); await reject("ITEM_PUBLISH_DATA_INVALID", 400);
    });
    it.each([
        { colorVariants: null }, { colorVariants: {} }, { colorVariants: [null] },
        { colorVariants: [{ sizes: null }] }, { colorVariants: [{ sizes: {} }] },
        { colorVariants: [{ sizes: [null] }] }, { colorVariants: [{ sizes: [{}] }] },
        { colorVariants: [{}, { inventory: null }] },
    ])("E03: 後方要素・配列%jを拒否", async patch => {
        Object.assign(editing, { attributes: { inventory: root(), ...patch } }); await reject("ITEM_ATTRIBUTES_INVALID", 500);
    });
    it("E03: initial負数より後方サイズの構造不正を先に検出", async () => {
        Object.assign(editing, { attributes: { inventory: { ...root(), initial: -1 }, colorVariants: [{ sizes: [{}] }] } });
        await reject("ITEM_ATTRIBUTES_INVALID", 500);
    });
});
describe("P0 transactionの待機・例外とP1失敗許容通知", () => {
    const phases = ["getMyItemEditing", "getMyItemForUpdate", "getUser", "validateMaster", "getCategories", ...updates.slice(0, -1)] as const;
    it.each(phases)("T01: %s失敗は同一例外で後続停止", async key => {
        const failure = new Error(key);
        mocks[key].mockRejectedValue(failure);
        await expect(run()).rejects.toBe(failure);
        const start = phases.indexOf(key);
        for (const next of phases.slice(start + 1)) expect(mocks[next]).not.toHaveBeenCalled();
        expect(mocks.createNotification).not.toHaveBeenCalled();
    });
    it.each(phases)("T01: %s保留中は後続と成功返却なし", async key => {
        const gate = deferred<unknown>(), entered = deferred<void>();
        const original = mocks[key].getMockImplementation()!;
        mocks[key].mockImplementation((...args: unknown[]) => { entered.resolve(); return gate.promise.then(() => original(...args)); });
        let done = false;
        const pending = run().finally(() => { done = true; });
        try {
            await entered.promise;
            expect(done).toBe(false);
            for (const next of phases.slice(phases.indexOf(key) + 1)) expect(mocks[next]).not.toHaveBeenCalled();
            expect(mocks.createNotification).not.toHaveBeenCalled();
        } finally { gate.resolve(undefined); await pending; }
        expect(await pending).toBe(456);
    });
    it.each([false, true])("T01 N03: 外側transaction保留後reject=%sを待つ", async fail => {
        const gate = deferred<void>(), entered = deferred<void>(), failure = new Error("commit-simulated");
        mocks.transaction.mockImplementation(async callback => {
            const value = await callback(transaction); entered.resolve(); await gate.promise; return value;
        });
        let done = false;
        const pending = run().finally(() => { done = true; });
        const result = fail ? expect(pending).rejects.toBe(failure) : expect(pending).resolves.toBe(456);
        try { await entered.promise; expect(done).toBe(false); expect(mocks.createNotification).not.toHaveBeenCalled(); }
        finally { if (fail) gate.reject(failure); else gate.resolve(); await result; }
        expect(mocks.createNotification).toHaveBeenCalledTimes(fail ? 0 : 1);
    });
    it("T01: transaction開始失敗で取得も通知もなし", async () => {
        const failure = new Error("begin"); mocks.transaction.mockRejectedValue(failure);
        await expect(run()).rejects.toBe(failure); expect(mocks.getMyItemEditing).not.toHaveBeenCalled(); expect(mocks.createNotification).not.toHaveBeenCalled();
    });
    it("N03: 通知完了を待たず返し、rejectを捕捉する", async () => {
        const gate = deferred<void>(), failure = new Error("notification");
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.createNotification.mockReturnValue(gate.promise);
        try { expect(await run()).toBe(456); expect(log).not.toHaveBeenCalled(); }
        finally { gate.reject(failure); await gate.promise.catch(() => {}); }
        expect(log).toHaveBeenCalledExactlyOnceWith("service createNotification error", failure);
    });
});
