import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../../../test/fixtures/items/updateItem/fixtures.js";
vi.mock("../../../models/index.js", () => ({ Sale: {}, Item: {} }));
import { updateSale } from "../sale.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
const dataFactory = () => ({ before_price: null, discount_rate: null, discount_amount: null, sale_flag: false });
beforeEach(() => vi.resetAllMocks());
describe("S01 既存sale更新・DB境界", () => {
    it("S01: DTOとtを同一参照でupdateし新規生成しない", async () => {
        const update = vi.fn().mockResolvedValue(undefined);
        const instance = { update } as unknown as Parameters<typeof updateSale>[0]["sale"];
        const data = dataFactory();
        expect(await updateSale({ sale: instance, data, transaction })).toBeUndefined();
        expect(update).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(update.mock.calls[0][0]).toBe(data);
        expect(update.mock.calls[0][1].transaction).toBe(transaction);
    });
    it("S01: instance更新の完了を待つ", async () => {
        const gate = deferred<void>(); const update = vi.fn().mockReturnValue(gate.promise);
        const instance = { update } as unknown as Parameters<typeof updateSale>[0]["sale"];
        let done = false;
        const pending = updateSale({ sale: instance, data: dataFactory(), transaction }).finally(() => { done = true; });
        try { await Promise.resolve(); expect(update).toHaveBeenCalledTimes(1); expect(done).toBe(false); }
        finally { gate.resolve(); await pending; }
        expect(done).toBe(true);
    });
    it("S01: update失敗を同一Errorで伝播", async () => {
        const failure = new Error("update"); const update = vi.fn().mockRejectedValue(failure);
        const instance = { update } as unknown as Parameters<typeof updateSale>[0]["sale"];
        await expect(updateSale({ sale: instance, data: dataFactory(), transaction })).rejects.toBe(failure);
        expect(update).toHaveBeenCalledTimes(1);
    });
});
