import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
const model = vi.hoisted(() => ({ create: vi.fn(), findOne: vi.fn(), findByPk: vi.fn(), count: vi.fn() }));
vi.mock("../../../../models/index.js", () => ({ Item: model }));
import { createItem } from "../create.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
beforeEach(() => vi.resetAllMocks());
describe("S04 作成service", () => {
    it("S04: dataとtransaction同一参照と戻り値", async () => {
        const data = {} as Parameters<typeof createItem>[0]["data"];
        const row = { id: 101 };
        model.create.mockResolvedValue(row);
        const result = await createItem({ data, transaction });
        expect(model.create).toHaveBeenCalledExactlyOnceWith(data, { transaction: transaction });
        expect(model.create.mock.calls[0][0]).toBe(data);
        expect(model.create.mock.calls[0][1].transaction).toBe(transaction);
        expect(result).toBe(101);
    });
    it("S04: 同一Errorを伝播", async () => {
        const failure = new Error("create");
        model.create.mockRejectedValue(failure);
        await expect(createItem({ data: {} as Parameters<typeof createItem>[0]["data"], transaction })).rejects.toBe(
            failure,
        );
    });
});
