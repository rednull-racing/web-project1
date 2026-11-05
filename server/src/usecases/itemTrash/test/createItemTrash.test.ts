import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
import type { ItemForTrash, CreateItemTrashParams } from "../../../types/serviceType/itemTrash.js";

const m = vi.hoisted(() => ({
    transaction: vi.fn(), query: vi.fn(), create: vi.fn(), detach: vi.fn(),
    video: vi.fn(), sale: vi.fn(), shipping: vi.fn(), item: vi.fn(), notify: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ default: { transaction: m.transaction } }));
vi.mock("../../../services/itemTrash/query.js", () => ({ getMyItemForTrash: m.query }));
vi.mock("../../../services/itemTrash/command.js", () => ({ createItemTrash: m.create }));
vi.mock("../../../services/itemReport/itemReport.js", () => ({ detachItemReports: m.detach }));
vi.mock("../../../services/video/video.js", () => ({ deleteVideo: m.video }));
vi.mock("../../../services/sale/sale.js", () => ({ deleteSale: m.sale }));
vi.mock("../../../services/itemShippingProfile/itemShippingProfile.js", () => ({ deleteShipping: m.shipping }));
vi.mock("../../../services/items/index.js", () => ({ deleteItem: m.item }));
vi.mock("../../../services/notification/notification.js", () => ({ createNotification: m.notify }));
import { createItemTrashUseCase } from "../createItemTrash.js";
import { AppError } from "../../../errors.js";

const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
};
// DB操作を行わない境界代用品。モデルメソッドはservice側の責務とする。
const source = (): ItemForTrash => ({
    item: { id: 101, seller_id: 7, status: "soldout", name: "退避商品", detail: "説明", image_url: ["image-1", "image-2"], first_image_url: "first", item_condition_id: 2, gender_type: "men", age_type: "adult", recommend: false, category_id: 3, brand_id: 4, brand_aliases_id: 5, attributes: { inventory: { initial: 8, current: 2, low_stock_ratio: 0.2 } }, price: 999 },
    video: { id: 201, title: "動画名", summary: "要約", thumbnail_url: "thumb", duration: 0, original_url: "original", converted_url: "converted", status: "ready" },
    sale: { id: 301, before_price: 0 },
    shipping: { id: 401, shipping_day_id: 11, shipping_service_id: 12, shipping_place_id: 13, shipping_service_free_text: "配送説明" },
} as ItemForTrash);
const expectedData = (): CreateItemTrashParams["data"] => ({
    item_id: 101, seller_id: 7, name: "退避商品", detail: "説明", image_url: ["image-1", "image-2"], first_image_url: "first", item_condition_id: 2, gender_type: "men", age_type: "adult", recommend: false, category_id: 3, brand_id: 4, brand_aliases_id: 5, attributes: { inventory: { initial: 8, current: 2, low_stock_ratio: 0.2 } }, price: 0,
    title: "動画名", summary: "要約", thumbnail_url: "thumb", duration: 0, original_url: "original", converted_url: "converted", video_status: "ready", shipping_day_id: 11, shipping_service_id: 12, shipping_place_id: 13, shipping_service_free_text: "配送説明",
});
const params = { itemId: 101, userId: 7 };
const tx = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
const stages = [m.query, m.create, m.detach, m.video, m.sale, m.shipping, m.item];
let current: ItemForTrash;
let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
    vi.resetAllMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    current = source();
    m.query.mockResolvedValue(current);
    m.create.mockResolvedValue({ id: 501, name: "保存後商品名", first_image_url: "saved-first" });
    for (const mock of [m.detach, m.video, m.sale, m.shipping, m.item, m.notify]) mock.mockResolvedValue(undefined);
    m.transaction.mockImplementation((callback: (transaction: Transaction) => Promise<unknown>) => callback(tx));
});
afterEach(() => { vi.restoreAllMocks(); });

describe("createItemTrashUseCase P0 保存・transaction・通知", () => {
    it("U01 全列を対応付け、同じtransactionで削除し、保存先の値で通知する", async () => {
        const before = structuredClone(current);
        await expect(createItemTrashUseCase(params)).resolves.toBeUndefined();
        expect(m.query).toHaveBeenCalledExactlyOnceWith({ ...params, transaction: tx });
        expect(m.create).toHaveBeenCalledExactlyOnceWith({ data: expectedData(), transaction: tx });
        expect(m.detach).toHaveBeenCalledExactlyOnceWith({ itemId: 101, transaction: tx });
        expect(m.video).toHaveBeenCalledExactlyOnceWith({ video: current.video, transaction: tx });
        expect(m.sale).toHaveBeenCalledExactlyOnceWith({ sale: current.sale, transaction: tx });
        expect(m.shipping).toHaveBeenCalledExactlyOnceWith({ shipping: current.shipping, transaction: tx });
        expect(m.item).toHaveBeenCalledExactlyOnceWith({ item: current.item, transaction: tx });
        for (const mock of stages) expect(mock.mock.calls[0]?.[0].transaction).toBe(tx);
        for (let i = 1; i < stages.length; i++) expect(stages[i - 1]!.mock.invocationCallOrder[0]).toBeLessThan(stages[i]!.mock.invocationCallOrder[0]!);
        expect(m.notify).toHaveBeenCalledExactlyOnceWith({ data: { read_user_id: 7, url: "/item/deleted/501", message_image: "saved-first", message: "商品「保存後商品名」が削除されました。削除された商品の詳細はこちらのページからご確認ください。なお、復元される場合は削除日から30日以内に行ってください。", type: "ITEM" } });
        expect(current).toEqual(before);
    });
    it("U02 関連が全てnullでも削除し、価格をItem.priceへフォールバックしない", async () => {
        current.video = current.sale = current.shipping = null;
        await createItemTrashUseCase(params);
        const expected = expectedData();
        Object.assign(expected, { price: null, title: null, summary: null, thumbnail_url: null, duration: null, original_url: null, converted_url: null, video_status: null, shipping_day_id: null, shipping_service_id: null, shipping_place_id: null, shipping_service_free_text: null });
        expect(m.create).toHaveBeenCalledExactlyOnceWith({ data: expected, transaction: tx });
        for (const mock of [m.video, m.sale, m.shipping]) expect(mock).not.toHaveBeenCalled();
        expect(m.item).toHaveBeenCalledOnce();
    });
    it("U03 sale.before_priceのnullを保持する", async () => {
        current.sale!.before_price = null;
        await createItemTrashUseCase(params);
        expect(m.create.mock.calls[0]?.[0].data.price).toBeNull();
    });
    it("U04 不存在・他人・消費済みに対応するnullは404で後続未実行", async () => {
        m.query.mockResolvedValue(null);
        const result = createItemTrashUseCase(params);
        await expect(result).rejects.toBeInstanceOf(AppError);
        await expect(result).rejects.toMatchObject({ code: "ITEM_NOT_FOUND", statusCode: 404 });
        for (const mock of [...stages.slice(1), m.notify]) expect(mock).not.toHaveBeenCalled();
    });
    it.each(stages.map((mock, index) => ({ mock, index })))("U05 段階$indexの失敗は同じ例外を伝え後続未実行", async ({ mock, index }) => {
        const error = new Error(`stage-${index}`);
        mock.mockRejectedValue(error);
        await expect(createItemTrashUseCase(params)).rejects.toBe(error);
        for (const later of [...stages.slice(index + 1), m.notify]) expect(later).not.toHaveBeenCalled();
    });
    it("U06 transaction開始失敗はDB処理・通知未実行", async () => {
        const error = new Error("begin");
        m.transaction.mockRejectedValue(error);
        await expect(createItemTrashUseCase(params)).rejects.toBe(error);
        for (const mock of [...stages, m.notify]) expect(mock).not.toHaveBeenCalled();
    });
    it("U07 callback終了後の外側transaction失敗では通知しない", async () => {
        const error = new Error("commit");
        m.transaction.mockImplementation(async (callback: (transaction: Transaction) => Promise<unknown>) => { await callback(tx); throw error; });
        await expect(createItemTrashUseCase(params)).rejects.toBe(error);
        expect(m.item).toHaveBeenCalledOnce();
        expect(m.notify).not.toHaveBeenCalled();
    });
    it("U08 callback終了後も外側transaction完了まで通知・成功を返さない", async () => {
        const gate = deferred(); const entered = deferred(); let done = false;
        m.transaction.mockImplementation(async (callback: (transaction: Transaction) => Promise<unknown>) => { const value = await callback(tx); entered.resolve(); await gate.promise; return value; });
        const running = createItemTrashUseCase(params).finally(() => { done = true; });
        try { await entered.promise; expect(done).toBe(false); expect(m.notify).not.toHaveBeenCalled(); }
        finally { gate.resolve(); await running; }
        expect(m.notify).toHaveBeenCalledOnce();
    });
    it("U09 通知保留を待たず成功し、後からの失敗を捕捉する", async () => {
        const gate = deferred(); const entered = deferred(); let done = false;
        m.notify.mockImplementation(() => { entered.resolve(); return gate.promise; });
        const running = createItemTrashUseCase(params).finally(() => { done = true; });
        try { await entered.promise; await Promise.resolve(); expect(done).toBe(true); expect(m.notify).toHaveBeenCalledOnce(); }
        finally { gate.reject(new Error("notification")); await gate.promise.catch(() => undefined); await running; }
        expect(consoleError).toHaveBeenCalledOnce();
    });
    it.each(stages.map((mock, index) => ({ mock, index })))("U10 段階$indexの保留中は後続へ進まない", async ({ mock, index }) => {
        const gate = deferred(); const entered = deferred(); let done = false;
        const value = index === 0 ? current : index === 1 ? { id: 501, name: "保存後商品名", first_image_url: "saved-first" } : undefined;
        mock.mockImplementation(async () => { entered.resolve(); await gate.promise; return value; });
        const running = createItemTrashUseCase(params).finally(() => { done = true; });
        try { await entered.promise; expect(done).toBe(false); for (const later of [...stages.slice(index + 1), m.notify]) expect(later).not.toHaveBeenCalled(); }
        finally { gate.resolve(); await running; }
    });
});
