import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
import { deferred } from "../../../../../test/fixtures/items/updateItem/fixtures.js";
const mocks = vi.hoisted(() => ({ item: vi.fn(), video: vi.fn(), sale: vi.fn(), shipping: vi.fn() }));
vi.mock("../../../../models/index.js", () => ({
    Item: { findOne: mocks.item },
    Video: { findByPk: mocks.video },
    Sale: { findByPk: mocks.sale },
    ItemShippingProfile: { findByPk: mocks.shipping },
    Categories: {},
    User: {},
}));
import { getMyItemForUpdate } from "../relation.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
const row = () => ({ id: 456, seller_id: 7, status: "soldout", video_id: 101, sale_id: 202, shipping_id: 303 });
const run = () => getMyItemForUpdate({ itemId: 456, userId: 7, transaction });
const keys = ["item", "video", "sale", "shipping"] as const;
beforeEach(() => {
    vi.resetAllMocks();
    mocks.item.mockResolvedValue(row());
    mocks.video.mockResolvedValue({ id: 101 });
    mocks.sale.mockResolvedValue({ id: 202 });
    mocks.shipping.mockResolvedValue({ id: 303 });
});
describe("S01 所有者条件と既存関連の順次ロック（Modelモック）", () => {
    it("S01: soldoutも取得しitem→video→sale→shippingを同じtでロック", async () => {
        const item = row();
        mocks.item.mockResolvedValue(item);
        const result = await run();
        expect(mocks.item).toHaveBeenCalledExactlyOnceWith({
            attributes: ["id", "seller_id", "status", "video_id", "sale_id", "shipping_id"],
            where: { id: 456, seller_id: 7 },
            transaction,
            lock: "UPDATE",
        });
        for (const [key, id] of [
            ["video", 101],
            ["sale", 202],
            ["shipping", 303],
        ] as const) {
            expect(mocks[key]).toHaveBeenCalledExactlyOnceWith(id, { transaction, lock: "UPDATE", attributes: ["id"] });
            expect(mocks[key].mock.calls[0][1].transaction).toBe(transaction);
        }
        expect(result).toEqual({ item, video: { id: 101 }, sale: { id: 202 }, shipping: { id: 303 } });
        expect(result!.item).toBe(item);
        const order = keys.map((key) => mocks[key].mock.invocationCallOrder[0]);
        expect(order).toEqual([...order].sort((a, b) => a - b));
    });
    it("S01: 商品nullは関連検索なしでnull", async () => {
        mocks.item.mockResolvedValue(null);
        expect(await run()).toBeNull();
        for (const key of keys.slice(1)) expect(mocks[key]).not.toHaveBeenCalled();
    });
    it.each([
        ["video_id", "video"],
        ["sale_id", "sale"],
        ["shipping_id", "shipping"],
    ] as const)("S01: %s=nullなら該当取得なし・関連null", async (field, key) => {
        mocks.item.mockResolvedValue({ ...row(), [field]: null });
        const result = await run();
        expect(result![key]).toBeNull();
        expect(mocks[key]).not.toHaveBeenCalled();
    });
    it.each(["video", "sale", "shipping"] as const)("S01: %s取得nullをそのまま渡す", async (key) => {
        mocks[key].mockResolvedValue(null);
        expect((await run())![key]).toBeNull();
    });
    it.each(keys)("S01: %s取得失敗を同一例外で伝播し後続なし", async (key) => {
        const failure = new Error(key);
        mocks[key].mockRejectedValue(failure);
        await expect(run()).rejects.toBe(failure);
        for (const next of keys.slice(keys.indexOf(key) + 1)) expect(mocks[next]).not.toHaveBeenCalled();
    });
    it.each(keys)("S01: %s取得完了まで後続と返却を待つ", async (key) => {
        const gate = deferred<unknown>(),
            entered = deferred<void>();
        const value = await mocks[key]();
        mocks[key].mockClear();
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
            for (const next of keys.slice(keys.indexOf(key) + 1)) expect(mocks[next]).not.toHaveBeenCalled();
        } finally {
            gate.resolve(value);
            await pending;
        }
    });
});
