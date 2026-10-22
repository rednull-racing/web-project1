import type { Request, Response } from "express-serve-static-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";
import { deferred, makeBody } from "../../../usecases/itemEditing/test/createItemEditingDraft.fixtures.js";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../usecases/itemEditing/convertItemEditingVideo.js", () => ({ convertItemEditingVideoUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/createItemEditingDraft.js", () => ({
    createItemEditingDraftUseCase: mocks.create,
}));
vi.mock("../../../usecases/itemEditing/createItemEditing.js", () => ({ createItemEditingUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/updateConfirm.js", () => ({ updateItemEditingConfirmUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.js", () => ({
    createItemEditingCopyUseCase: vi.fn(),
}));
import { createItemEditingDraftController } from "../itemEditing.js";

const request = () =>
    ({
        user: { id: 7 },
        validatedBody: makeBody(),
        body: { itemDraftId: 99, userId: 8, seller_id: 8 },
        params: { id: "100" },
    }) as unknown as Request;
const response = () => {
    const status = vi.fn(),
        json = vi.fn(),
        next = vi.fn();
    const res = { status, json } as unknown as Response;
    status.mockReturnValue(res);
    return { res, status, json, next };
};
beforeEach(() => {
    vi.resetAllMocks();
    mocks.create.mockResolvedValue(456);
});
describe("P0/P1: controllerの検証済み入力・成功応答・例外伝播", () => {
    it("C01 C02 V05: 認証IDとvalidatedBodyのIDだけを採用し201で新規IDを返す", async () => {
        const { res, status, json, next } = response();
        await createItemEditingDraftController(request(), res, next);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemDraftId: 11 });
        expect(status).toHaveBeenCalledExactlyOnceWith(201);
        expect(json).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 456 });
        expect(next).not.toHaveBeenCalled();
    });
    it.each([new AppError("ITEM_DRAFT_NOT_FOUND", 404), new Error("DB error")])(
        "C03: %sを同じ参照でnextへ渡し成功応答なし",
        async (error) => {
            mocks.create.mockRejectedValue(error);
            const { res, status, json, next } = response();
            await createItemEditingDraftController(request(), res, next);
            expect(next).toHaveBeenCalledExactlyOnceWith(error);
            expect(next.mock.calls[0][0]).toBe(error);
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
        },
    );
    it("C04: usecase保留中は201を送信せず完了を待つ", async () => {
        const gate = deferred<number>();
        mocks.create.mockReturnValue(gate.promise);
        const { res, status, json, next } = response();
        const pending = createItemEditingDraftController(request(), res, next);
        const settled = Promise.allSettled([pending]);
        try {
            expect(mocks.create).toHaveBeenCalledOnce();
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
        } finally {
            gate.resolve(456);
            await settled;
        }
        await pending;
        expect(status).toHaveBeenCalledExactlyOnceWith(201);
        expect(json).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 456 });
    });
});
