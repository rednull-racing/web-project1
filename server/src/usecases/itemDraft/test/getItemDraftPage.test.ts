import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";
import type { getMyItemDraftPage } from "../../../services/itemDraft/query.js";
import { deferred, makeDraft } from "../../../../test/fixtures/itemDraft/getItemDraftPage/fixtures.js";
const mocks = vi.hoisted(() => ({ get: vi.fn<typeof getMyItemDraftPage>() }));
vi.mock("../../../services/itemDraft/query.js", () => ({ getMyItemDraftPage: mocks.get }));
import { getItemDraftPageUseCase } from "../getItemDraftPage.js";
const run = () => getItemDraftPageUseCase({ itemDraftId: 101, userId: 7 });
beforeEach(() => vi.resetAllMocks());
describe("P0/P1/P2 getItemDraftPage usecase", () => {
    it("U01 所有者条件を渡し取得値を同一参照で返す", async () => {
        const row = makeDraft();
        mocks.get.mockResolvedValue(row);
        expect(await run()).toBe(row);
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemDraftId: 101, userId: 7 });
    });
    it("U01 不存在はAppError 404", async () => {
        mocks.get.mockResolvedValue(null);
        const pending = run();
        await expect(pending).rejects.toBeInstanceOf(AppError);
        await expect(pending).rejects.toMatchObject({ code: "ITEM_DRAFT_NOT_FOUND", statusCode: 404 });
        expect(mocks.get).toHaveBeenCalledOnce();
    });
    it("U02 元例外を伝播", async () => {
        const error = new Error("db");
        mocks.get.mockRejectedValue(error);
        await expect(run()).rejects.toBe(error);
        expect(mocks.get).toHaveBeenCalledOnce();
    });
    it.each(["成功", "null", "失敗"])("U03 取得%sまで完了しない", async (mode) => {
        const gate = deferred<Awaited<ReturnType<typeof getMyItemDraftPage>>>();
        const row = makeDraft(),
            error = new Error("db");
        mocks.get.mockReturnValue(gate.promise);
        let completed = false;
        const pending = run().finally(() => {
            completed = true;
        });
        const settled = Promise.allSettled([pending]);
        try {
            expect(mocks.get).toHaveBeenCalledOnce();
            await Promise.resolve();
            expect(completed).toBe(false);
        } finally {
            if (mode === "失敗") gate.reject(error);
            else gate.resolve(mode === "null" ? null : row);
            await settled;
        }
        if (mode === "成功") expect(await pending).toBe(row);
        else if (mode === "失敗") await expect(pending).rejects.toBe(error);
        else await expect(pending).rejects.toMatchObject({ code: "ITEM_DRAFT_NOT_FOUND", statusCode: 404 });
    });
    it("U04 逆順完了でも結果が混ざらない", async () => {
        const gate = deferred<Awaited<ReturnType<typeof getMyItemDraftPage>>>();
        const a = makeDraft(),
            b = makeDraft(202);
        mocks.get.mockReturnValueOnce(gate.promise).mockResolvedValueOnce(b);
        const pending = run();
        try {
            expect(await getItemDraftPageUseCase({ itemDraftId: 202, userId: 8 })).toBe(b);
            expect(mocks.get).toHaveBeenNthCalledWith(2, { itemDraftId: 202, userId: 8 });
        } finally {
            gate.resolve(a);
            await pending;
        }
        expect(await pending).toBe(a);
    });
});
