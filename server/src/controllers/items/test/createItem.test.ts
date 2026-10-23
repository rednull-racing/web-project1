import "../../../../test/fixtures/items/createItem/httpMocks.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { deferred } from "../../../../test/fixtures/items/createItem/fixtures.js";
import { AppError } from "../../../errors.js";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../usecases/items/create/createItem.js", () => ({ createItemUseCase: mocks.create }));
import { createItemController } from "../items.js";
beforeEach(() => {
    vi.resetAllMocks();
    mocks.create.mockResolvedValue(456);
});
afterEach(() => vi.restoreAllMocks());
const args = () => {
    const req = {
        user: { id: 7 },
        validatedBody: { itemEditingId: 11 },
        body: { itemEditingId: 99 },
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
    it("C01: 検証済み入力と認証IDだけを渡す", async () => {
        const a = args();
        await createItemController(a.req, a.res, a.next);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: 11 });
        expect(a.status).toHaveBeenCalledExactlyOnceWith(201);
        expect(a.json).toHaveBeenCalledExactlyOnceWith({ itemId: 456 });
        expect(a.nextSpy).not.toHaveBeenCalled();
    });
    it("C02: usecase完了まで応答を待つ", async () => {
        const gate = deferred<number>();
        mocks.create.mockReturnValue(gate.promise);
        const a = args();
        const pending = createItemController(a.req, a.res, a.next);
        try {
            expect(a.status).not.toHaveBeenCalled();
        } finally {
            gate.resolve(456);
            await pending;
        }
        expect(a.json).toHaveBeenCalledExactlyOnceWith({ itemId: 456 });
    });
    it.each([new AppError("ITEM_EDITING_NOT_FOUND", 404), new Error("internal SQL")])(
        "C03 T10: 同一Error %sをnextへ",
        async (error) => {
            mocks.create.mockRejectedValue(error);
            const a = args();
            await createItemController(a.req, a.res, a.next);
            expect(a.nextSpy).toHaveBeenCalledExactlyOnceWith(error);
            expect(a.status).not.toHaveBeenCalled();
            expect(a.json).not.toHaveBeenCalled();
        },
    );
});
