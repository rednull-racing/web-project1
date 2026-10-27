import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../../../test/fixtures/items/updateItem/fixtures.js";
vi.mock("../../../models/index.js", () => ({ ItemShippingProfile: {}, Item: {} }));
import { updateShipping } from "../itemShippingProfile.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
const dataFactory = () => ({
    shipping_day_id: 1,
    shipping_service_id: 2,
    shipping_place_id: 3,
    shipping_service_free_text: null,
});
beforeEach(() => vi.resetAllMocks());
describe("S01 既存shipping更新・DB境界", () => {
    it("S01: DTOとtを同一参照でupdateし新規生成しない", async () => {
        const update = vi.fn().mockResolvedValue(undefined);
        const instance = { update } as unknown as Parameters<typeof updateShipping>[0]["shipping"];
        const data = dataFactory();
        expect(await updateShipping({ shipping: instance, data, transaction })).toBeUndefined();
        expect(update).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(update.mock.calls[0][0]).toBe(data);
        expect(update.mock.calls[0][1].transaction).toBe(transaction);
    });
    it("S01: instance更新の完了を待つ", async () => {
        const gate = deferred<void>();
        const update = vi.fn().mockReturnValue(gate.promise);
        const instance = { update } as unknown as Parameters<typeof updateShipping>[0]["shipping"];
        let done = false;
        const pending = updateShipping({ shipping: instance, data: dataFactory(), transaction }).finally(() => {
            done = true;
        });
        try {
            await Promise.resolve();
            expect(update).toHaveBeenCalledTimes(1);
            expect(done).toBe(false);
        } finally {
            gate.resolve();
            await pending;
        }
        expect(done).toBe(true);
    });
    it("S01: update失敗を同一Errorで伝播", async () => {
        const failure = new Error("update");
        const update = vi.fn().mockRejectedValue(failure);
        const instance = { update } as unknown as Parameters<typeof updateShipping>[0]["shipping"];
        await expect(updateShipping({ shipping: instance, data: dataFactory(), transaction })).rejects.toBe(failure);
        expect(update).toHaveBeenCalledTimes(1);
    });
});
