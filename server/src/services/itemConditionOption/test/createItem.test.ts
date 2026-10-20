import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
const model = vi.hoisted(() => ({ create: vi.fn(), findOne: vi.fn(), findByPk: vi.fn(), count: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ ItemConditionOption: model }));
import { getItemCondition } from "../itemConditionOption.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
beforeEach(() => vi.resetAllMocks());
describe("S07 S08 参照service", () => {
    it.each([true, false])("S07 S08: transactionあり=%sの引数・null・同一Error", async (withTransaction) => {
        const args = { conditionId: 21, ...(withTransaction ? { transaction } : {}) };
        const row = { id: 21 };
        model.findByPk.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
        expect(await getItemCondition(args)).toBe(row);
        expect(await getItemCondition(args)).toBeNull();
        if (withTransaction)
            expect(model.findByPk).toHaveBeenNthCalledWith(1, 21, { transaction });
        else
            expect(model.findByPk).toHaveBeenNthCalledWith(1, 21);
        const failure = new Error("read");
        model.findByPk.mockRejectedValueOnce(failure);
        await expect(getItemCondition(args)).rejects.toBe(failure);
    });
});
