import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../../../test/fixtures/items/updateItem/fixtures.js";
vi.mock("../../../models/index.js", () => ({ Video: {}, Item: {} }));
import { updateVideo } from "../video.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
const dataFactory = () => ({ thumbnail_url: "t", title: "変更", summary: null, duration: null, original_url: "o", converted_url: null, status: null });
beforeEach(() => vi.resetAllMocks());
describe("S01 既存video更新・DB境界", () => {
    it("S01: DTOとtを同一参照でupdateし新規生成しない", async () => {
        const update = vi.fn().mockResolvedValue(undefined);
        const instance = { update } as unknown as Parameters<typeof updateVideo>[0]["video"];
        const data = dataFactory();
        expect(await updateVideo({ video: instance, data, transaction })).toBeUndefined();
        expect(update).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(update.mock.calls[0][0]).toBe(data);
        expect(update.mock.calls[0][1].transaction).toBe(transaction);
    });
    it("S01: instance更新の完了を待つ", async () => {
        const gate = deferred<void>(); const update = vi.fn().mockReturnValue(gate.promise);
        const instance = { update } as unknown as Parameters<typeof updateVideo>[0]["video"];
        let done = false;
        const pending = updateVideo({ video: instance, data: dataFactory(), transaction }).finally(() => { done = true; });
        try { await Promise.resolve(); expect(update).toHaveBeenCalledTimes(1); expect(done).toBe(false); }
        finally { gate.resolve(); await pending; }
        expect(done).toBe(true);
    });
    it("S01: update失敗を同一Errorで伝播", async () => {
        const failure = new Error("update"); const update = vi.fn().mockRejectedValue(failure);
        const instance = { update } as unknown as Parameters<typeof updateVideo>[0]["video"];
        await expect(updateVideo({ video: instance, data: dataFactory(), transaction })).rejects.toBe(failure);
        expect(update).toHaveBeenCalledTimes(1);
    });
});
