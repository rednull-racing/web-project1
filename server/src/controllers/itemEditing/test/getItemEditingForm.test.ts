import type { Request, Response } from "express-serve-static-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";
import { deferred, makeFormResult } from "../../../usecases/itemEditing/test/getItemEditingForm.fixtures.js";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../usecases/itemEditing/getItemEditingForm.js", () => ({ getItemEditingFormUseCase: mocks.get }));
vi.mock("../../../usecases/itemEditing/convertItemEditingVideo.js", () => ({
    convertItemEditingVideoUseCase: vi.fn(),
}));
vi.mock("../../../usecases/itemEditing/createItemEditing.js", () => ({ createItemEditingUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/createItemEditingDraft.js", () => ({ createItemEditingDraftUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/updateConfirm.js", () => ({ updateItemEditingConfirmUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.js", () => ({
    createItemEditingCopyUseCase: vi.fn(),
}));
import { getItemEditingFormController } from "../itemEditing.js";

const request = () =>
    ({
        user: { id: 7 },
        validatedParams: { id: 123 },
        params: { id: "999" },
        body: { userId: 8, seller_id: 8, itemEditingId: 999 },
        query: { userId: "8", seller_id: "8" },
    }) as unknown as Request;
const response = () => {
    const status = vi.fn(),
        json = vi.fn(),
        next = vi.fn();
    const res = { status, json } as unknown as Response;
    status.mockReturnValue(res);
    return { status, json, next, res };
};
beforeEach(() => vi.resetAllMocks());
describe("P0/P1 フォームcontrollerの入力・応答・停止位置", () => {
    it("C01: raw params/body/queryの偽装を無視し検証済みIDと認証IDで取得して200を返す", async () => {
        const row = makeFormResult();
        mocks.get.mockResolvedValue(row);
        const { res, status, json, next } = response();
        await getItemEditingFormController(request(), res, next);
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: 123 });
        expect(status).toHaveBeenCalledExactlyOnceWith(200);
        expect(json).toHaveBeenCalledExactlyOnceWith(row);
        expect(json.mock.calls[0][0]).toBe(row);
        expect(next).not.toHaveBeenCalled();
    });
    it.each([new AppError("ITEM_EDITING_NOT_FOUND", 404), new Error("DB failure")])(
        "C02: %sをnextへ同じ参照で渡し成功応答を送らない",
        async (error) => {
            mocks.get.mockRejectedValue(error);
            const { res, status, json, next } = response();
            await getItemEditingFormController(request(), res, next);
            expect(next).toHaveBeenCalledExactlyOnceWith(error);
            expect(next.mock.calls[0][0]).toBe(error);
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
        },
    );
    it.each([false, true])("C03: usecase保留中に応答せず解放後に応答/伝播する reject=%s", async (fail) => {
        const gate = deferred<ReturnType<typeof makeFormResult>>(),
            row = makeFormResult(),
            error = new Error("delayed failure");
        mocks.get.mockReturnValue(gate.promise);
        const { res, status, json, next } = response();
        const pending = getItemEditingFormController(request(), res, next);
        const settled = Promise.allSettled([pending]);
        try {
            await Promise.resolve();
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
            expect(next).not.toHaveBeenCalled();
        } finally {
            if (fail) gate.reject(error);
            else gate.resolve(row);
            await settled;
        }
        if (fail) {
            expect(next).toHaveBeenCalledExactlyOnceWith(error);
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
        } else {
            expect(status).toHaveBeenCalledExactlyOnceWith(200);
            expect(json).toHaveBeenCalledExactlyOnceWith(row);
            expect(next).not.toHaveBeenCalled();
        }
    });
    it("C04: JSON送信例外をnextへ渡しusecaseを再実行しない", async () => {
        mocks.get.mockResolvedValue(makeFormResult());
        const { res, status, json, next } = response(),
            error = new Error("send failure");
        json.mockImplementation(() => {
            throw error;
        });
        await getItemEditingFormController(request(), res, next);
        expect(next).toHaveBeenCalledExactlyOnceWith(error);
        expect(mocks.get).toHaveBeenCalledOnce();
        expect(status).toHaveBeenCalledExactlyOnceWith(200);
        expect(json).toHaveBeenCalledOnce();
    });
});

vi.mock("../../../usecases/itemEditing/getItemEditingFormMetadata.js", () => ({
    getItemEditingFormMetadataUseCase: vi.fn(),
}));

vi.mock("../../../usecases/itemEditing/getItemConfirmPage.js", () => ({ getItemConfirmPageUseCase: vi.fn() }));
