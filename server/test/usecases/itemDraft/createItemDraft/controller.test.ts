import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../src/errors.js";
import { deferred, makeBody } from "./fixtures.js";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../../src/usecases/itemDraft/createItemDraft.js", () => ({ createItemDraftUseCase: mocks.create }));
import { createItemDraftController } from "../../../../src/controllers/itemDraft.js";
const response = () => {
    const json = vi.fn(), status = vi.fn();
    const res = { json, status } as unknown as Response;
    status.mockReturnValue(res);
    return { res, json, status };
};
const request = () => ({ user: { id: 7 }, params: { id: "999" },
    body: { itemEditingId: 999, seller_id: 999 }, validatedBody: makeBody() } as unknown as Request);
const empty = { videoSignedUrl: null, thumbnailSignedUrl: null, itemImageSignedUrls: [], attributesImageSignedUrls: {} };
beforeEach(() => { vi.resetAllMocks(); });
describe("P0: controllerの引渡し・応答", () => {
    it.each([empty, { videoSignedUrl: { url: "post", fields: { key: "v" } }, thumbnailSignedUrl: "thumb",
        itemImageSignedUrls: [{ index: 1, url: "signed" }], attributesImageSignedUrls: { red: "red" } }])(
        "C01 C02 V18: 認証IDと検証済みbodyを渡し署名4項目%jだけ返す", async (result) => {
            mocks.create.mockResolvedValue({ ...result, id: 555 });
            const req = request(), { res, json, status } = response(), next = vi.fn();
            await createItemDraftController(req, res, next);
            expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, body: req.validatedBody });
            expect(mocks.create.mock.calls[0][0].body).toBe(req.validatedBody);
            expect(status).toHaveBeenCalledExactlyOnceWith(200);
            expect(json).toHaveBeenCalledExactlyOnceWith(result);
            expect(next).not.toHaveBeenCalled();
        });
    it.each([new AppError("ITEM_EDITING_NOT_FOUND", 404), new Error("failed")])(
        "C03: %sを同じ参照でnextに渡し成功応答なし", async (error) => {
            mocks.create.mockRejectedValue(error);
            const { res, json, status } = response(), next = vi.fn();
            await createItemDraftController(request(), res, next);
            expect(next).toHaveBeenCalledExactlyOnceWith(error);
            expect(next.mock.calls[0][0]).toBe(error);
            expect(status).not.toHaveBeenCalled(); expect(json).not.toHaveBeenCalled();
        });
    it("C04: usecaseが保留中は成功応答を送らない", async () => {
        const gate = deferred<typeof empty>(), started = deferred<void>();
        mocks.create.mockImplementation(() => { started.resolve(); return gate.promise; });
        const { res, json, status } = response(), next = vi.fn();
        const pending = createItemDraftController(request(), res, next);
        try { await started.promise; expect(status).not.toHaveBeenCalled(); expect(json).not.toHaveBeenCalled(); }
        finally { gate.resolve(empty); await pending; }
        expect(json).toHaveBeenCalledExactlyOnceWith(empty); expect(next).not.toHaveBeenCalled();
    });
});
