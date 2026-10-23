import { Op } from "sequelize";
import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
const model = vi.hoisted(() => ({ destroy: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ ItemEditing: model }));
import { destroyExpiredItemEditings } from "../command.js";
const transaction = {} as Transaction;
beforeEach(() => vi.resetAllMocks());
describe("P0: 期限付き一括削除のModel境界", () => {
    it.each([0, 4])("S01: lte・同じ期限とtransactionを渡し%i件を返す", async (count) => {
        const createdBefore = new Date("2026-10-18T03:00:00Z");
        model.destroy.mockResolvedValue(count);
        expect(await destroyExpiredItemEditings({ createdBefore, transaction })).toBe(count);
        expect(model.destroy).toHaveBeenCalledExactlyOnceWith({
            where: { createdAt: { [Op.lte]: createdBefore } },
            transaction,
        });
        expect(model.destroy.mock.calls[0][0].where.createdAt[Op.lte]).toBe(createdBefore);
        expect(model.destroy.mock.calls[0][0].transaction).toBe(transaction);
    });
    it("S02: 元のDB例外を伝播し再試行しない", async () => {
        const failure = new Error("database failed");
        model.destroy.mockRejectedValue(failure);
        await expect(destroyExpiredItemEditings({ createdBefore: new Date(), transaction })).rejects.toBe(failure);
        expect(model.destroy).toHaveBeenCalledOnce();
    });
});
