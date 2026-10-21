import type { Transaction } from "sequelize";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../../../test/fixtures/items/createItem/fixtures.js";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), destroy: vi.fn() }));
vi.mock("../../../db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../services/itemEditing/command.js", () => ({ destroyExpiredItemEditings: mocks.destroy }));
import { cronDeleteItemEditingUseCase } from "../cronDeleteItemEditing.js";

const transaction = {} as Transaction;
beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-21T03:00:00Z"));
    mocks.transaction.mockImplementation(async (callback: (t: Transaction) => Promise<number>) =>
        callback(transaction),
    );
});
afterEach(() => vi.restoreAllMocks());

describe("P0: 期限算出・transaction完了と例外", () => {
    it.each([0, 3])("U01: %i件を同じtransactionで削除する", async (count) => {
        mocks.destroy.mockResolvedValue(count);
        expect(await cronDeleteItemEditingUseCase()).toBe(count);
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.destroy).toHaveBeenCalledExactlyOnceWith({
            createdBefore: new Date("2026-10-18T03:00:00Z"),
            transaction,
        });
        expect(mocks.destroy.mock.calls[0][0].transaction).toBe(transaction);
    });
    it("U02: 削除の完了まで返さず、同じ例外を伝播する", async () => {
        const gate = deferred<number>();
        const failure = new Error("delete failed");
        mocks.destroy.mockReturnValue(gate.promise);
        let settled = false;
        const pending = cronDeleteItemEditingUseCase();
        const checked = expect(pending).rejects.toBe(failure);
        void pending.then(
            () => {
                settled = true;
            },
            () => {
                settled = true;
            },
        );
        try {
            await Promise.resolve();
            expect(mocks.destroy).toHaveBeenCalledOnce();
            expect(settled).toBe(false);
        } finally {
            gate.reject(failure);
            await checked;
        }
    });
    it.each([false, true])("U03: 外側transactionの失敗=%sでも完了を待つ", async (reject) => {
        const gate = deferred<number>();
        const entered = deferred<void>();
        const failure = new Error("transaction completion failed");
        mocks.destroy.mockResolvedValue(5);
        mocks.transaction.mockImplementation(async (callback: (t: Transaction) => Promise<number>) => {
            expect(await callback(transaction)).toBe(5);
            entered.resolve();
            return gate.promise;
        });
        let settled = false;
        const pending = cronDeleteItemEditingUseCase();
        const checked = reject ? expect(pending).rejects.toBe(failure) : expect(pending).resolves.toBe(5);
        void pending.then(
            () => {
                settled = true;
            },
            () => {
                settled = true;
            },
        );
        try {
            await entered.promise;
            expect(settled).toBe(false);
        } finally {
            if (reject) gate.reject(failure);
            else gate.resolve(5);
            await checked;
        }
    });
    it("U04: transaction開始失敗で削除しない", async () => {
        const failure = new Error("begin failed");
        mocks.transaction.mockRejectedValue(failure);
        await expect(cronDeleteItemEditingUseCase()).rejects.toBe(failure);
        expect(mocks.destroy).not.toHaveBeenCalled();
    });
});
