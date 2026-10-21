import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
const model = vi.hoisted(() => ({ create: vi.fn(), findOne: vi.fn(), findByPk: vi.fn(), count: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ Video: model }));
import { createVideo } from "../video.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
beforeEach(() => vi.resetAllMocks());
describe("S04 作成service", () => {
    it("S04: dataとtransaction同一参照と戻り値", async () => {
        const data = {} as Parameters<typeof createVideo>[0]["data"];
        const row = { id: 101 };
        model.create.mockResolvedValue(row);
        const result = await createVideo({ data, transaction });
        expect(model.create).toHaveBeenCalledExactlyOnceWith(data, { transaction: transaction });
        expect(model.create.mock.calls[0][0]).toBe(data);
        expect(model.create.mock.calls[0][1].transaction).toBe(transaction);
        expect(result).toBe(row);
    });
    it("S04: 同一Errorを伝播", async () => {
        const failure = new Error("create");
        model.create.mockRejectedValue(failure);
        await expect(createVideo({ data: {} as Parameters<typeof createVideo>[0]["data"], transaction })).rejects.toBe(
            failure,
        );
    });
});
