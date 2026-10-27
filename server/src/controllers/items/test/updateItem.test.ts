import "../../../../test/fixtures/items/updateItem/httpMocks.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { deferred } from "../../../../test/fixtures/items/createItem/fixtures.js";
import { AppError } from "../../../errors.js";
const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../../../usecases/items/update/updateItem.js", () => ({ updateItemUseCase: mocks.update }));
import { updateItemController } from "../items.js";
beforeEach(() => {
    vi.resetAllMocks();
    mocks.update.mockResolvedValue(456);
});
afterEach(() => vi.restoreAllMocks());
const args = () => {
    const req = {
        user: { id: 7 },
        validatedBody: { itemEditingId: 11 },
        body: { itemEditingId: 99, userId: 98, seller_id: 98, itemId: 97 },
        params: { id: "90" },
        query: { itemEditingId: "89" },
    } as unknown as Request;
    const status = vi.fn();
    const json = vi.fn();
    const next = vi.fn();
    status.mockReturnValue({ json });
    return {
        req,
        res: { status, json } as unknown as Response,
        next: next as NextFunction,
        status,
        json,
        nextSpy: next,
    };
};
describe("C controller", () => {
    it("H01: 検証済み入力と認証IDだけを渡す", async () => {
        const a = args();
        await updateItemController(a.req, a.res, a.next);
        expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: 11 });
        expect(a.status).toHaveBeenCalledExactlyOnceWith(201);
        expect(a.json).toHaveBeenCalledExactlyOnceWith({ itemId: 456 });
        expect(a.nextSpy).not.toHaveBeenCalled();
    });
    it("T01: usecase完了まで応答を待つ", async () => {
        const gate = deferred<number>();
        mocks.update.mockReturnValue(gate.promise);
        const a = args();
        const pending = updateItemController(a.req, a.res, a.next);
        try {
            expect(a.status).not.toHaveBeenCalled();
        } finally {
            gate.resolve(456);
            await pending;
        }
        expect(a.json).toHaveBeenCalledExactlyOnceWith({ itemId: 456 });
    });
    it.each([new AppError("ITEM_EDITING_NOT_FOUND", 404), new Error("internal SQL")])(
        "T01: 同一Error %sをnextへ",
        async (error) => {
            mocks.update.mockRejectedValue(error);
            const a = args();
            await updateItemController(a.req, a.res, a.next);
            expect(a.nextSpy).toHaveBeenCalledExactlyOnceWith(error);
            expect(a.status).not.toHaveBeenCalled();
            expect(a.json).not.toHaveBeenCalled();
        },
    );
});

it("T01: 保留usecaseのreject後に同一例外をnextへ渡し成功応答しない", async () => {
    const gate = deferred<number>();
    const error = new AppError("ITEM_NOT_FOUND", 404);
    mocks.update.mockReturnValue(gate.promise);
    const a = args();
    const pending = updateItemController(a.req, a.res, a.next);
    try {
        expect(a.status).not.toHaveBeenCalled();
        expect(a.json).not.toHaveBeenCalled();
        expect(a.nextSpy).not.toHaveBeenCalled();
    } finally {
        gate.reject(error);
        await pending;
    }
    expect(a.nextSpy).toHaveBeenCalledExactlyOnceWith(error);
    expect(a.status).not.toHaveBeenCalled();
    expect(a.json).not.toHaveBeenCalled();
});
it("T01: JSON送信失敗はnextへ渡しusecaseを再実行しない", async () => {
    const a = args();
    const error = new Error("response failed");
    a.json.mockImplementation(() => {
        throw error;
    });
    await updateItemController(a.req, a.res, a.next);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(a.nextSpy).toHaveBeenCalledExactlyOnceWith(error);
});
