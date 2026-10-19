import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getMyItemDraft } from "../../../services/itemDraft/query.js";
import type { deleteItemDraft } from "../../../services/itemDraft/command.js";
import { deferred, expectNotFound, makeDraft, makeTransaction, waitForGate } from "../../../../test/fixtures/itemDraft/deleteItemDraft/fixtures.js";
const mocks = vi.hoisted(() => ({
    transaction: vi.fn<(callback: (t: Transaction) => Promise<void>) => Promise<void>>(),
    get: vi.fn<typeof getMyItemDraft>(), remove: vi.fn<typeof deleteItemDraft>(),
}));
vi.mock("../../../db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../services/itemDraft/query.js", () => ({ getMyItemDraft: mocks.get }));
vi.mock("../../../services/itemDraft/command.js", () => ({ deleteItemDraft: mocks.remove }));
import { deleteItemDraftUseCase } from "../deleteItemDraft.js";
const t = makeTransaction(), row = makeDraft();
const run = () => deleteItemDraftUseCase({ itemDraftId: 101, userId: 7 });
beforeEach(() => {
    vi.resetAllMocks(); mocks.get.mockResolvedValue(row); mocks.remove.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async cb => { await cb(t); });
});
describe("P0/P1: deleteItemDraft usecase", () => {
    it("U01: 同じtと取得モデルだけを削除へ渡す", async () => {
        expect(await run()).toBeUndefined();
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemDraftId: 101, userId: 7, transaction: t });
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ itemDraft: row, transaction: t });
        expect(mocks.remove.mock.calls[0][0].itemDraft).toBe(row);
        expect(mocks.remove.mock.calls[0][0].transaction).toBe(t);
        expect(mocks.get.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
    });
    it("U02: 不存在は404で削除しない", async () => {
        mocks.get.mockResolvedValue(null); await expectNotFound(run());
        expect(mocks.remove).not.toHaveBeenCalled();
    });
    it.each(["開始", "取得", "削除", "commit相当"])("U03 U04 U05 U06: %s失敗は元例外を伝播し後続を止める", async stage => {
        const error = new Error(stage);
        if (stage === "開始") mocks.transaction.mockRejectedValue(error);
        if (stage === "取得") mocks.get.mockRejectedValue(error);
        if (stage === "削除") mocks.remove.mockRejectedValue(error);
        if (stage === "commit相当") mocks.transaction.mockImplementation(async cb => { await cb(t); throw error; });
        await expect(run()).rejects.toBe(error);
        expect(mocks.get).toHaveBeenCalledTimes(stage === "開始" ? 0 : 1);
        expect(mocks.remove).toHaveBeenCalledTimes(["開始", "取得"].includes(stage) ? 0 : 1);
    });
    it.each(["成功", "不存在", "例外"])("U07: 取得%sまで削除しない", async mode => {
        const gate = deferred<Awaited<ReturnType<typeof getMyItemDraft>>>(), entered = deferred<void>(), error = new Error(mode);
        mocks.get.mockImplementation(() => { entered.resolve(); return gate.promise; });
        let completed = false;
        const pending = run().finally(() => { completed = true; }), settled = Promise.allSettled([pending]);
        try { await waitForGate(entered.promise, pending); expect(completed).toBe(false); expect(mocks.remove).not.toHaveBeenCalled(); }
        finally { if (mode === "例外") gate.reject(error); else gate.resolve(mode === "不存在" ? null : row); await settled; }
        if (mode === "例外") await expect(pending).rejects.toBe(error);
        else if (mode === "不存在") await expectNotFound(pending);
        else { await pending; expect(mocks.remove).toHaveBeenCalledOnce(); }
    });
    it.each(["成功", "例外"])("U08: 削除%sまでusecaseを完了しない", async mode => {
        const gate = deferred<void>(), entered = deferred<void>(), error = new Error(mode);
        mocks.remove.mockImplementation(() => { entered.resolve(); return gate.promise; });
        let completed = false;
        const pending = run().finally(() => { completed = true; }), settled = Promise.allSettled([pending]);
        try { await waitForGate(entered.promise, pending); expect(completed).toBe(false); expect(mocks.get).toHaveBeenCalledOnce(); }
        finally { if (mode === "例外") gate.reject(error); else gate.resolve(); await settled; }
        if (mode === "例外") await expect(pending).rejects.toBe(error); else await pending;
    });
    it("U09: callback終了後もtransaction全体の完了を待つ", async () => {
        const entered = deferred<void>(), gate = deferred<void>();
        mocks.transaction.mockImplementation(async cb => { await cb(t); entered.resolve(); await gate.promise; });
        let completed = false; const pending = run().then(() => { completed = true; });
        try { await waitForGate(entered.promise, pending); expect(completed).toBe(false); expect(mocks.remove).toHaveBeenCalledOnce(); }
        finally { gate.resolve(); await pending; }
        expect(completed).toBe(true);
    });
    it("U10: 交差した2要求のtransactionとモデルが混ざらない", async () => {
        const tB = makeTransaction("tB"), rowB = makeDraft(202), entered = deferred<void>(), gate = deferred<void>();
        mocks.transaction.mockImplementationOnce(async cb => { await cb(t); }).mockImplementationOnce(async cb => { await cb(tB); });
        mocks.get.mockImplementation(async params => {
            if (params.itemDraftId === 101) { entered.resolve(); await gate.promise; return row; }
            expect(params).toEqual({ itemDraftId: 202, userId: 8, transaction: tB }); return rowB;
        });
        const a = run();
        try {
            await waitForGate(entered.promise, a);
            await deleteItemDraftUseCase({ itemDraftId: 202, userId: 8 });
            expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ itemDraft: rowB, transaction: tB });
        } finally { gate.resolve(); await a; }
        expect(mocks.remove).toHaveBeenNthCalledWith(2, { itemDraft: row, transaction: t });
    });
});
