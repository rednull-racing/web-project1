import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../../../../test/fixtures/items/updateItem/fixtures.js";
vi.mock("../../../../models/index.js", () => ({ Item: {} }));
import { updateItem } from "../update.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
const dataFactory = () => ({ name: "変更", image_url: ["b", "a"], attributes: { inventory: { initial: 0, current: 0, low_stock_ratio: .2 } }, status: "soldout", save_at: new Date() }) as Parameters<typeof updateItem>[0]["data"];
beforeEach(() => vi.resetAllMocks());
describe("S01 既存item更新・DB境界", () => {
    it("S01: DTOとtを同一参照でupdateし新規生成しない", async () => {
        const update = vi.fn().mockResolvedValue(undefined);
        const instance = { update } as unknown as Parameters<typeof updateItem>[0]["item"];
        const data = dataFactory();
        expect(await updateItem({ item: instance, data, transaction })).toBeUndefined();
        expect(update).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(update.mock.calls[0][0]).toBe(data);
        expect(update.mock.calls[0][1].transaction).toBe(transaction);
    });
    it("S01: instance更新の完了を待つ", async () => {
        const gate = deferred<void>(); const update = vi.fn().mockReturnValue(gate.promise);
        const instance = { update } as unknown as Parameters<typeof updateItem>[0]["item"];
        let done = false;
        const pending = updateItem({ item: instance, data: dataFactory(), transaction }).finally(() => { done = true; });
        try { await Promise.resolve(); expect(update).toHaveBeenCalledTimes(1); expect(done).toBe(false); }
        finally { gate.resolve(); await pending; }
        expect(done).toBe(true);
    });
    it("S01: update失敗を同一Errorで伝播", async () => {
        const failure = new Error("update"); const update = vi.fn().mockRejectedValue(failure);
        const instance = { update } as unknown as Parameters<typeof updateItem>[0]["item"];
        await expect(updateItem({ item: instance, data: dataFactory(), transaction })).rejects.toBe(failure);
        expect(update).toHaveBeenCalledTimes(1);
    });
});
