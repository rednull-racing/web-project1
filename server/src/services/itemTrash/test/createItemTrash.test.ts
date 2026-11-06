import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
import type { CreateItemTrashParams } from "../../../types/serviceType/itemTrash.js";

const m = vi.hoisted(() => ({ item: vi.fn(), video: vi.fn(), sale: vi.fn(), shipping: vi.fn(), create: vi.fn() }));
vi.mock("../../../models/index.js", () => ({
    Item: { findOne: m.item },
    Video: { findByPk: m.video },
    Sale: { findByPk: m.sale },
    ItemShippingProfile: { findByPk: m.shipping },
    ItemTrash: { create: m.create },
}));
vi.mock("../../../db.js", () => ({ default: { query: vi.fn() } }));
import { getMyItemForTrash } from "../query.js";
import { createItemTrash } from "../command.js";
const tx = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
const params = () => ({ itemId: 101, userId: 7, transaction: tx });
const item = () => ({ id: 101, video_id: 201, sale_id: 301, shipping_id: 401 });
const stages = [m.item, m.video, m.sale, m.shipping];
const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((ok) => {
        resolve = ok;
    });
    return { promise, resolve };
};
beforeEach(() => {
    vi.resetAllMocks();
    m.item.mockResolvedValue(item());
    m.video.mockResolvedValue({ id: 201 });
    m.sale.mockResolvedValue({ id: 301 });
    m.shipping.mockResolvedValue({ id: 401 });
});
describe("getMyItemForTrash P0 所有者条件・行ロック・関連取得", () => {
    it("S01 所有者条件と取得列を明示し、全行に同じtransactionとUPDATEロックを渡す", async () => {
        const result = await getMyItemForTrash(params());
        expect(result).toEqual({ item: item(), video: { id: 201 }, sale: { id: 301 }, shipping: { id: 401 } });
        expect(m.item).toHaveBeenCalledExactlyOnceWith({
            attributes: [
                "id",
                "status",
                "video_id",
                "sale_id",
                "shipping_id",
                "name",
                "detail",
                "image_url",
                "first_image_url",
                "item_condition_id",
                "seller_id",
                "gender_type",
                "age_type",
                "recommend",
                "category_id",
                "brand_id",
                "brand_aliases_id",
                "attributes",
            ],
            where: { id: 101, seller_id: 7 },
            transaction: tx,
            lock: "UPDATE",
        });
        expect(m.video).toHaveBeenCalledExactlyOnceWith(201, {
            attributes: [
                "id",
                "title",
                "summary",
                "thumbnail_url",
                "duration",
                "original_url",
                "converted_url",
                "status",
            ],
            transaction: tx,
            lock: "UPDATE",
        });
        expect(m.sale).toHaveBeenCalledExactlyOnceWith(301, {
            attributes: ["id", "before_price"],
            transaction: tx,
            lock: "UPDATE",
        });
        expect(m.shipping).toHaveBeenCalledExactlyOnceWith(401, {
            attributes: [
                "id",
                "shipping_day_id",
                "shipping_service_id",
                "shipping_place_id",
                "shipping_service_free_text",
            ],
            transaction: tx,
            lock: "UPDATE",
        });
        expect(m.item.mock.calls[0]?.[0].transaction).toBe(tx);
        for (const mock of stages.slice(1)) expect(mock.mock.calls[0]?.[1].transaction).toBe(tx);
        for (let i = 1; i < stages.length; i++)
            expect(stages[i - 1]!.mock.invocationCallOrder[0]).toBeLessThan(stages[i]!.mock.invocationCallOrder[0]!);
    });
    it("S02 Itemがnullなら関連を取得しない", async () => {
        m.item.mockResolvedValue(null);
        expect(await getMyItemForTrash(params())).toBeNull();
        for (const mock of stages.slice(1)) expect(mock).not.toHaveBeenCalled();
    });
    it("S03 関連FKがnullなら各検索を省略しnullを返す", async () => {
        const value = { id: 101, video_id: null, sale_id: null, shipping_id: null };
        m.item.mockResolvedValue(value);
        expect(await getMyItemForTrash(params())).toEqual({ item: value, video: null, sale: null, shipping: null });
        for (const mock of stages.slice(1)) expect(mock).not.toHaveBeenCalled();
    });
    it.each([m.video, m.sale, m.shipping].map((mock, index) => ({ mock, index })))(
        "S04 関連$indexが不存在でもnullとして返す",
        async ({ mock, index }) => {
            mock.mockResolvedValue(null);
            const result = await getMyItemForTrash(params());
            expect(result?.[["video", "sale", "shipping"][index] as "video" | "sale" | "shipping"]).toBeNull();
            expect(m.shipping).toHaveBeenCalledOnce();
        },
    );
    it.each(stages.map((mock, index) => ({ mock, index })))(
        "S05 取得$indexの例外はそのまま伝え後続を実行しない",
        async ({ mock, index }) => {
            const error = new Error(`query-${index}`);
            mock.mockRejectedValue(error);
            await expect(getMyItemForTrash(params())).rejects.toBe(error);
            for (const later of stages.slice(index + 1)) expect(later).not.toHaveBeenCalled();
        },
    );
    it.each(stages.map((mock, index) => ({ mock, index })))(
        "S06 取得$indexを待機し、後続取得を先行しない",
        async ({ mock, index }) => {
            const entered = deferred();
            const gate = deferred();
            let done = false;
            const value = index === 0 ? item() : { id: 700 + index };
            mock.mockImplementation(async () => {
                entered.resolve();
                await gate.promise;
                return value;
            });
            const running = getMyItemForTrash(params()).finally(() => {
                done = true;
            });
            try {
                await entered.promise;
                expect(done).toBe(false);
                for (const later of stages.slice(index + 1)) expect(later).not.toHaveBeenCalled();
            } finally {
                gate.resolve();
                await running;
            }
        },
    );
});

describe("createItemTrash P0 作成・引渡し・例外", () => {
    const data = (): CreateItemTrashParams["data"] => ({
        item_id: 101,
        name: "商品",
        detail: null,
        image_url: null,
        first_image_url: null,
        item_condition_id: null,
        seller_id: 7,
        gender_type: "unisex",
        age_type: "both",
        recommend: false,
        category_id: null,
        brand_id: null,
        brand_aliases_id: null,
        attributes: {},
        price: null,
        title: null,
        summary: null,
        thumbnail_url: null,
        duration: null,
        original_url: null,
        converted_url: null,
        video_status: null,
        shipping_day_id: null,
        shipping_service_id: null,
        shipping_place_id: null,
        shipping_service_free_text: null,
    });
    it("S07 dataとtransactionをそのままcreateへ渡し作成結果を返す", async () => {
        const values = data();
        const saved = { id: 501 };
        m.create.mockResolvedValue(saved);
        expect(await createItemTrash({ data: values, transaction: tx })).toBe(saved);
        expect(m.create).toHaveBeenCalledExactlyOnceWith(values, { transaction: tx });
        expect(m.create.mock.calls[0]?.[0]).toBe(values);
        expect(m.create.mock.calls[0]?.[1].transaction).toBe(tx);
    });
    it("S08 Model作成の例外はそのまま伝える", async () => {
        const error = new Error("create");
        m.create.mockRejectedValue(error);
        await expect(createItemTrash({ data: data(), transaction: tx })).rejects.toBe(error);
        expect(m.create).toHaveBeenCalledOnce();
    });
    it("S09 Model作成が完了するまでserviceを完了しない", async () => {
        const gate = deferred();
        let done = false;
        m.create.mockImplementation(async () => {
            await gate.promise;
            return { id: 501 };
        });
        const running = createItemTrash({ data: data(), transaction: tx }).finally(() => {
            done = true;
        });
        try {
            await Promise.resolve();
            expect(done).toBe(false);
        } finally {
            gate.resolve();
            await running;
        }
    });
});
