import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
const model = vi.hoisted(() => ({ create: vi.fn(), findOne: vi.fn(), findByPk: vi.fn(), count: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ ItemEditing: model }));
import { getMyItemEditing } from "../query.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
beforeEach(() => vi.resetAllMocks());
import { deleteItemEditing } from "../command.js";
import { makeEditing, deferred } from "../../../../test/fixtures/items/createItem/fixtures.js";
describe("S01 S02 S03 所有権・ロック・削除", () => {
    it.each([true, false])("S01 S02: tあり=%sでwhere/lockと返値", async (withTransaction) => {
        const row = { id: 11 };
        model.findOne.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
        const args = { itemEditingId: 11, userId: 7, ...(withTransaction ? { transaction } : {}) };
        expect(await getMyItemEditing(args)).toBe(row);
        expect(await getMyItemEditing(args)).toBeNull();
        expect(model.findOne).toHaveBeenNthCalledWith(1, {
            where: { id: 11, seller_id: 7 },
            ...(withTransaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
        });
        const failure = new Error("find");
        model.findOne.mockRejectedValue(failure);
        await expect(getMyItemEditing(args)).rejects.toBe(failure);
    });
    it("S03: 同じモデルのdestroyをawait、同一Error伝播", async () => {
        const itemEditing = makeEditing();
        const gate = deferred<void>();
        const destroy = vi.fn().mockReturnValue(gate.promise);
        itemEditing.destroy = destroy;
        let done = false;
        const pending = deleteItemEditing({ itemEditing, transaction }).then(() => {
            done = true;
        });
        try {
            expect(destroy).toHaveBeenCalledExactlyOnceWith({ transaction });
            expect(done).toBe(false);
        } finally {
            gate.resolve();
            await pending;
        }
        const failure = new Error("destroy");
        destroy.mockRejectedValue(failure);
        await expect(deleteItemEditing({ itemEditing, transaction })).rejects.toBe(failure);
        expect(model.findOne).not.toHaveBeenCalled();
    });
});
