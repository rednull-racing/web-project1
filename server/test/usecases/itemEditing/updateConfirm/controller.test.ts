import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../src/errors.js";
import { makeBody } from "./fixtures.js";
const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../../../../src/usecases/itemEditing/updateConfirm.js", () => ({
    updateItemEditingConfirmUseCase: mocks.update,
}));
vi.mock("../../../../src/usecases/itemEditing/createItemEditing.js", () => ({ createItemEditingUseCase: vi.fn() }));
import { updateItemEditingConfirmController } from "../../../../src/controllers/itemEditing.js";
const response = () => {
    const json = vi.fn(),
        status = vi.fn();
    const res = { json, status } as unknown as Response;
    status.mockReturnValue(res);
    return { res, json, status };
};
const request = () =>
    ({
        params: { id: "11" },
        user: { id: 7 },
        body: { seller_id: 999, price: 1 },
        validatedBody: makeBody(),
    } as unknown as Request);
beforeEach(() => {
    vi.resetAllMocks();
});
describe("P1: controllerの引渡しとレスポンス", () => {
    it.each([
        { videoSignedUrl: null, thumbnailSignedUrl: null, itemImageSignedUrls: [], attributesImageSignedUrls: {} },
        {
            videoSignedUrl: { url: "post", fields: { key: "video" } },
            thumbnailSignedUrl: "thumbnail",
            itemImageSignedUrls: [
                { index: 1, url: "image-1" },
                { index: 3, url: "image-3" },
            ],
            attributesImageSignedUrls: { red: "red" },
        },
    ])("AF-S06 R01 R02 R08: 認証ID・validatedBodyを渡し署名4項目%jだけを200で返す", async (result) => {
        mocks.update.mockResolvedValue({ ...result, ignored: "返却しない" });
        const req = request();
        const { res, status, json } = response();
        const next = vi.fn();
        await updateItemEditingConfirmController(req, res, next);
        expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 11, userId: 7, body: req.validatedBody });
        expect(mocks.update.mock.calls[0][0].body).toBe(req.validatedBody);
        expect(status).toHaveBeenCalledExactlyOnceWith(200);
        expect(json).toHaveBeenCalledExactlyOnceWith(result);
        expect(next).not.toHaveBeenCalled();
    });
    it.each([new AppError("ITEM_EDITING_NOT_FOUND", 404), new Error("failed"), new AppError("ITEM_IMAGE_NULL", 400)])(
        "AF-I06 R03: %sを同一オブジェクトでnextに渡し成功応答を送らない",
        async (error) => {
            mocks.update.mockRejectedValue(error);
            const { res, status, json } = response();
            const next = vi.fn();
            await updateItemEditingConfirmController(request(), res, next);
            expect(next).toHaveBeenCalledExactlyOnceWith(error);
            expect(next.mock.calls[0][0]).toBe(error);
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
        },
    );
});
