import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, makeItem, transactionFixture } from "../../../../usecases/itemEditing/createItemEditingCopy/test/fixtures.js";

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), create: vi.fn() }));
vi.mock("../../../../models/index.js", () => ({
    Item: { findOne: mocks.findOne }, ItemEditing: { create: mocks.create },
    Video: { marker: "video" }, Sale: { marker: "sale" }, ItemShippingProfile: { marker: "shipping" },
    Categories: {}, User: {},
}));
import { Video, Sale, ItemShippingProfile } from "../../../../models/index.js";
import { getMyItemWithVideoSaleShipping } from "../relation.js";

let transaction: Transaction;
const params = () => ({ userId: 7, itemId: 101, transaction });
const lockOptions = () => ({
    attributes: ["id"], where: { id: 101, seller_id: 7, deleted_at: null }, transaction, lock: transaction.LOCK.UPDATE,
});
const readOptions = () => ({
    where: { id: 101, seller_id: 7, deleted_at: null },
    attributes: [
        "id", "seller_id", "status", "name", "detail", "image_url", "item_condition_id",
        "first_image_url", "gender_type", "age_type", "recommend", "category_id",
        "brand_id", "brand_aliases_id", "attributes",
    ],
    include: [
        { model: Video, attributes: [
            "thumbnail_url", "title", "summary", "duration", "original_url", "converted_url", "status",
        ], required: false },
        { model: Sale, attributes: ["before_price"], required: false },
        { model: ItemShippingProfile, attributes: [
            "shipping_day_id", "shipping_service_id", "shipping_place_id", "shipping_service_free_text",
        ], required: false },
    ],
    transaction,
});
beforeEach(() => { vi.resetAllMocks(); transaction = transactionFixture(); });

describe("P0/P1 取得serviceの呼出し契約（DB非接続）", () => {
    it("S01 S02 T01: 所有者込みでItemだけをロック後、関連データを同じtransactionで取得する", async () => {
        const item = makeItem();
        mocks.findOne.mockResolvedValueOnce({ id: 101 }).mockResolvedValueOnce(item);
        expect(await getMyItemWithVideoSaleShipping(params())).toBe(item);
        expect(mocks.findOne).toHaveBeenCalledTimes(2);
        expect(mocks.findOne).toHaveBeenNthCalledWith(1, lockOptions());
        expect(mocks.findOne).toHaveBeenNthCalledWith(2, readOptions());
        expect(mocks.findOne.mock.calls[0][0].transaction).toBe(transaction);
        expect(mocks.findOne.mock.calls[1][0].transaction).toBe(transaction);
    });
    it("S03: ロック用SELECTがnullなら再取得しない", async () => {
        mocks.findOne.mockResolvedValue(null);
        expect(await getMyItemWithVideoSaleShipping(params())).toBeNull();
        expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith(lockOptions());
    });
    it("S04: ロック成功後の再取得nullもそのまま返す", async () => {
        mocks.findOne.mockResolvedValueOnce({ id: 101 }).mockResolvedValueOnce(null);
        expect(await getMyItemWithVideoSaleShipping(params())).toBeNull();
        expect(mocks.findOne).toHaveBeenCalledTimes(2);
    });
    it.each([1, 2])("S05 S06: SELECT%sの完了まで次処理／返却へ進まない", async (step) => {
        const gate = deferred<unknown>();
        const item = makeItem();
        if (step === 1) mocks.findOne.mockReturnValueOnce(gate.promise).mockResolvedValueOnce(item);
        else mocks.findOne.mockResolvedValueOnce({ id: 101 }).mockReturnValueOnce(gate.promise);
        let done = false;
        const pending = getMyItemWithVideoSaleShipping(params()).finally(() => { done = true; });
        try {
            // 2回目のSELECTへ進むために、最初のawaitの継続だけを待つ。
            await Promise.resolve();
            expect(mocks.findOne).toHaveBeenCalledTimes(step);
            expect(done).toBe(false);
        } finally { gate.resolve(step === 1 ? { id: 101 } : item); await pending; }
        expect(await pending).toBe(item);
    });
    it.each([1, 2])("S05 S06 E05 E06: SELECT%sの例外を伝播し後続SELECTを打ち切る", async (step) => {
        const error = new Error("select-" + step);
        if (step === 2) mocks.findOne.mockResolvedValueOnce({ id: 101 });
        mocks.findOne.mockRejectedValueOnce(error);
        await expect(getMyItemWithVideoSaleShipping(params())).rejects.toBe(error);
        expect(mocks.findOne).toHaveBeenCalledTimes(step);
    });
    it("S07: transaction省略時は従来どおり1回の関連付きSELECTを行う", async () => {
        const item = makeItem();
        mocks.findOne.mockResolvedValue(item);
        expect(await getMyItemWithVideoSaleShipping({ userId: 7, itemId: 101 })).toBe(item);
        expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({
            where: { id: 101, seller_id: 7 }, attributes: undefined,
            include: [{ model: Video }, { model: Sale }, { model: ItemShippingProfile }], transaction: undefined,
        });
    });
});
