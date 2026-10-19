import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";
import { deferred } from "../../../../test/fixtures/itemDraft/deleteItemDraft/fixtures.js";
const mocks = vi.hoisted(() => ({ remove: vi.fn(), create: vi.fn() }));
vi.mock("../../../usecases/itemDraft/deleteItemDraft.js", () => ({ deleteItemDraftUseCase: mocks.remove }));
vi.mock("../../../usecases/itemDraft/createItemDraft.js", () => ({ createItemDraftUseCase: mocks.create }));
import { deleteItemDraftController } from "../itemDraft.js";
const prepare = () => {
    const req = {
        user: { id: 7 }, validatedParams: { id: 101 }, params: { id: "999" },
        body: { userId: 8, seller_id: 8, id: 888 }, query: { userId: "8", id: "777" },
    } as unknown as Request;
    const json = vi.fn(), status = vi.fn().mockReturnValue({ json }), next = vi.fn();
    const res = { status, json } as unknown as Response;
    return { req, res, status, json, next, run: () => deleteItemDraftController(req, res, next) };
};
beforeEach(() => { vi.resetAllMocks(); mocks.remove.mockResolvedValue(undefined); });
describe("P0/P1: deleteItemDraft controller", () => {
    it("C01 C02: 検証済みIDと認証所有者だけを渡し200を返す", async () => {
        const f = prepare();
        expect(await f.run()).toBeUndefined();
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ itemDraftId: 101, userId: 7 });
        expect(f.status).toHaveBeenCalledExactlyOnceWith(200);
        expect(f.json).toHaveBeenCalledExactlyOnceWith({ message: "下書き商品を削除しました" });
        expect(f.next).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each([new AppError("ITEM_DRAFT_NOT_FOUND", 404), new Error("db")])("C03: %sを同じ参照でnextへ渡す", async error => {
        mocks.remove.mockRejectedValue(error);
        const f = prepare(); await f.run();
        expect(f.next).toHaveBeenCalledExactlyOnceWith(error);
        expect(f.next.mock.calls[0][0]).toBe(error);
        expect(f.status).not.toHaveBeenCalled(); expect(f.json).not.toHaveBeenCalled();
    });
    it.each(["成功", "失敗"])("C04: usecase%sまで応答しない", async mode => {
        const gate = deferred<void>(), error = new Error("保留失敗");
        mocks.remove.mockReturnValue(gate.promise);
        const f = prepare(), pending = f.run();
        try {
            expect(mocks.remove).toHaveBeenCalledOnce();
            expect(f.status).not.toHaveBeenCalled(); expect(f.json).not.toHaveBeenCalled(); expect(f.next).not.toHaveBeenCalled();
        } finally { if (mode === "成功") gate.resolve(); else gate.reject(error); await pending; }
        if (mode === "成功") expect(f.json).toHaveBeenCalledExactlyOnceWith({ message: "下書き商品を削除しました" });
        else { expect(f.next).toHaveBeenCalledExactlyOnceWith(error); expect(f.json).not.toHaveBeenCalled(); }
    });
    it("C05: 送信失敗後にusecaseを再実行しない", async () => {
        const f = prepare(), error = new Error("送信失敗");
        f.json.mockImplementation(() => { throw error; });
        await f.run();
        expect(f.next).toHaveBeenCalledExactlyOnceWith(error);
        expect(mocks.remove).toHaveBeenCalledOnce(); expect(mocks.create).not.toHaveBeenCalled();
    });
});
