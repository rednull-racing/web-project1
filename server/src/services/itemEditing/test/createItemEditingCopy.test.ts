import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { editingResult, expectedData, transactionFixture } from "../../../usecases/itemEditing/createItemEditingCopy/test/fixtures.js";

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), create: vi.fn() }));
vi.mock("../../../models/index.js", () => ({
    ItemEditing: { create: mocks.create },
}));
import { createItemEditingCopy } from "../command.js";

let transaction: Transaction;
beforeEach(() => { vi.resetAllMocks(); transaction = transactionFixture(); });

describe("P0/P1 作成serviceの呼出し契約（DB非接続）", () => {
    it("S08 T01: 作成dataとtransactionを同じ参照でcreateへ渡す", async () => {
        const data = expectedData(), result = editingResult();
        mocks.create.mockResolvedValue(result);
        expect(await createItemEditingCopy({ data, transaction })).toBe(result);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(mocks.create.mock.calls[0][0]).toBe(data);
        expect(mocks.create.mock.calls[0][1].transaction).toBe(transaction);
    });
    it("S09: Model.createの例外をそのまま伝播する", async () => {
        const error = new Error("create");
        mocks.create.mockRejectedValue(error);
        await expect(createItemEditingCopy({ data: expectedData(), transaction })).rejects.toBe(error);
        expect(mocks.create).toHaveBeenCalledTimes(1);
        expect(mocks.findOne).not.toHaveBeenCalled();
    });
});
