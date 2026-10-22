import type { Request, Response } from "express-serve-static-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";
import { deferred } from "../../../usecases/itemEditing/createItemEditingCopy/test/fixtures.js";

const mocks = vi.hoisted(() => ({ copy: vi.fn() }));
vi.mock("../../../usecases/itemEditing/convertItemEditingVideo.js", () => ({ convertItemEditingVideoUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.js", () => ({
    createItemEditingCopyUseCase: mocks.copy,
}));
vi.mock("../../../usecases/itemEditing/createItemEditing.js", () => ({ createItemEditingUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/createItemEditingDraft.js", () => ({ createItemEditingDraftUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/updateConfirm.js", () => ({ updateItemEditingConfirmUseCase: vi.fn() }));
import { createItemEditingCopyController } from "../itemEditing.js";

const request = () =>
    ({
        user: { id: 7 },
        body: { itemId: 999, seller_id: 8, userId: 8, price: 1, itemEditingId: 999 },
        validatedBody: { itemId: 101 },
    }) as unknown as Request;
const response = () => {
    const status = vi.fn(),
        json = vi.fn();
    const res = { status, json } as unknown as Response;
    status.mockReturnValue(res);
    return { res, status, json };
};
beforeEach(() => {
    vi.resetAllMocks();
    mocks.copy.mockResolvedValue(456);
});

describe("P1 controllerの入力境界・応答", () => {
    it("C01 C02 V05: 認証IDとvalidatedBodyだけを渡し新規IDのみ201で返す", async () => {
        const { res, status, json } = response(),
            next = vi.fn();
        await createItemEditingCopyController(request(), res, next);
        expect(mocks.copy).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemId: 101 });
        expect(status).toHaveBeenCalledExactlyOnceWith(201);
        expect(json).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 456 });
        expect(next).not.toHaveBeenCalled();
    });
    it.each([new AppError("ITEM_NOT_FOUND", 404), new Error("internal")])(
        "C03: %sを同一オブジェクトでnextへ渡し成功応答しない",
        async (error) => {
            mocks.copy.mockRejectedValue(error);
            const { res, status, json } = response(),
                next = vi.fn();
            await createItemEditingCopyController(request(), res, next);
            expect(next).toHaveBeenCalledExactlyOnceWith(error);
            expect(next.mock.calls[0][0]).toBe(error);
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
        },
    );
    it.each(["resolve", "reject"])("A03: usecaseの%s完了までHTTP応答を保留する", async (mode) => {
        const gate = deferred<number>(),
            error = new Error("delayed");
        mocks.copy.mockReturnValue(gate.promise);
        const { res, status, json } = response(),
            next = vi.fn();
        const pending = createItemEditingCopyController(request(), res, next);
        try {
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
            expect(next).not.toHaveBeenCalled();
        } finally {
            if (mode === "resolve") gate.resolve(456);
            else gate.reject(error);
            await pending;
        }
        if (mode === "resolve") expect(json).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 456 });
        else {
            expect(next).toHaveBeenCalledExactlyOnceWith(error);
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
        }
    });
});
