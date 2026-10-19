import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, draftColumns, makeDraft, makeTransaction } from "../../../../test/fixtures/itemDraft/deleteItemDraft/fixtures.js";
const mocks = vi.hoisted(() => ({ findOne: vi.fn(), destroy: vi.fn(), create: vi.fn(), staticDestroy: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ ItemDraft: { findOne: mocks.findOne, create: mocks.create, destroy: mocks.staticDestroy } }));
import { getMyItemDraft } from "../query.js";
import { deleteItemDraft } from "../command.js";
const t = makeTransaction();
const row = () => Object.assign(makeDraft(), { destroy: mocks.destroy });
beforeEach(() => vi.resetAllMocks());
describe("P0/P1: deleteItemDraftの共有service", () => {
    it.each(["モデル", "null"])("S01 S02 S04: %sを返し所有者条件と全取得列を指定する", async mode => {
        const result = mode === "null" ? null : row(); mocks.findOne.mockResolvedValue(result);
        expect(await getMyItemDraft({ itemDraftId: 101, userId: 7, transaction: t })).toBe(result);
        expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({ attributes: draftColumns, where: { id: 101, seller_id: 7 }, transaction: t, lock: t.LOCK.UPDATE });
        expect(mocks.findOne.mock.calls[0][0].transaction).toBe(t);
    });
    it("S05: 対象インスタンスだけを同じtで削除する", async () => {
        const draft = row(); expect(await deleteItemDraft({ itemDraft: draft, transaction: t })).toBeUndefined();
        expect(mocks.destroy).toHaveBeenCalledExactlyOnceWith({ transaction: t });
        expect(mocks.destroy.mock.calls[0][0].transaction).toBe(t);
        expect(mocks.staticDestroy).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each(["取得", "削除"])("S03 S06: %sの元例外を伝播し再試行しない", async step => {
        const error = new Error(step), fn = step === "取得" ? mocks.findOne : mocks.destroy;
        fn.mockRejectedValue(error);
        const pending = step === "取得" ? getMyItemDraft({ itemDraftId: 101, userId: 7, transaction: t }) : deleteItemDraft({ itemDraft: row(), transaction: t });
        await expect(pending).rejects.toBe(error); expect(fn).toHaveBeenCalledOnce();
        expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.staticDestroy).not.toHaveBeenCalled();
    });
    it.each(["取得", "削除"].flatMap(step => ["成功", "例外"].map(mode => ({ step, mode }))))("S07: $stepの$modeまで待機する", async ({ step, mode }) => {
        const gate = deferred<ReturnType<typeof row> | undefined>(), fn = step === "取得" ? mocks.findOne : mocks.destroy;
        const error = new Error("保留後の例外");
        fn.mockReturnValue(gate.promise); let completed = false;
        const pending = Promise.resolve(step === "取得" ? getMyItemDraft({ itemDraftId: 101, userId: 7, transaction: t }) : deleteItemDraft({ itemDraft: row(), transaction: t })).finally(() => { completed = true; });
        const settled = Promise.allSettled([pending]);
        try { expect(fn).toHaveBeenCalledOnce(); expect(completed).toBe(false); }
        finally { if (mode === "例外") gate.reject(error); else gate.resolve(step === "取得" ? row() : undefined); await settled; }
        if (mode === "例外") await expect(pending).rejects.toBe(error); else await pending;
        expect(completed).toBe(true);
    });
});
