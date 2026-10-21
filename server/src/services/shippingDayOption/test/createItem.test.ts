import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
const model = vi.hoisted(() => ({ create: vi.fn(), findOne: vi.fn(), findByPk: vi.fn(), count: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ ShippingDayOption: model }));
import { getShippingDay } from "../shippingDayOption.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
beforeEach(() => vi.resetAllMocks());
describe("S07 S08 参照service", () => {
    it.each([true, false])("S07 S08: transactionあり=%sの引数・null・同一Error", async (withTransaction) => {
        const args = { dayId: 21, ...(withTransaction ? { transaction } : {}) };
        const row = { id: 21 };
        model.findByPk.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
        expect(await getShippingDay(args)).toBe(row);
        expect(await getShippingDay(args)).toBeNull();
        if (withTransaction) expect(model.findByPk).toHaveBeenNthCalledWith(1, 21, { transaction });
        else expect(model.findByPk).toHaveBeenNthCalledWith(1, 21);
        const failure = new Error("read");
        model.findByPk.mockRejectedValueOnce(failure);
        await expect(getShippingDay(args)).rejects.toBe(failure);
    });
});
