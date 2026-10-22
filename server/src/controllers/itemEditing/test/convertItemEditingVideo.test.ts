import type { Request, Response } from "express-serve-static-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { videoHttpMocks as mocks } from "../../../../test/fixtures/itemEditing/convertItemEditingVideo/httpMocks.js";
import { deferred } from "../../../../test/fixtures/itemEditing/convertItemEditingVideo/httpFixtures.js";
import { AppError } from "../../../errors.js";
import { convertItemEditingVideoController } from "../itemEditing.js";

const prepare = () => {
    const req = {
        user: { id: 7 }, validatedParams: { id: 101 }, params: { id: "999" },
        body: { userId: 8, seller_id: 8, itemEditingId: 888 }, query: { userId: "8", id: "777" },
    } as unknown as Request;
    const json = vi.fn(), status = vi.fn(), next = vi.fn();
    const res = { status, json } as unknown as Response;
    status.mockReturnValue(res);
    return { json, status, next, run: () => convertItemEditingVideoController(req, res, next) };
};

beforeEach(() => { vi.resetAllMocks(); mocks.convert.mockResolvedValue(undefined); });
afterEach(() => vi.restoreAllMocks());

describe("P0/P1 非同期変換controller", () => {
    it("C01: 認証IDと検証済みIDだけを渡し受付202を返す", async () => {
        const f = prepare();
        await f.run();
        expect(mocks.convert).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: 101 });
        expect(f.status).toHaveBeenCalledExactlyOnceWith(202);
        expect(f.json).toHaveBeenCalledExactlyOnceWith({ message: "変換処理を受け付けました" });
        expect(f.next).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it("C02: usecase保留中も応答し解放後に再応答しない", async () => {
        const gate = deferred<void>(), started = deferred<void>();
        mocks.convert.mockImplementation(() => { started.resolve(); return gate.promise; });
        const f = prepare();
        try {
            await f.run();
            await started.promise;
            expect(f.json).toHaveBeenCalledExactlyOnceWith({ message: "変換処理を受け付けました" });
            expect(f.next).not.toHaveBeenCalled();
        } finally { gate.resolve(); await gate.promise; }
        expect(f.json).toHaveBeenCalledOnce();
    });
    it.each(["AppError", "Error", "同期throw"])("C03: %sを共通実行境界で捕捉しHTTPへ再送しない", async (kind) => {
        const error = kind === "AppError" ? new AppError("ITEM_EDITING_NOT_FOUND", 404) : new Error("internal");
        const caught = deferred<void>();
        const log = vi.spyOn(console, "error").mockImplementation(() => caught.resolve());
        if (kind === "同期throw") mocks.convert.mockImplementation(() => { throw error; });
        else mocks.convert.mockRejectedValue(error);
        const f = prepare();
        await f.run();
        await caught.promise;
        expect(log).toHaveBeenCalledExactlyOnceWith("Detached task failed", {
            taskName: "convertItemEditingVideo", target: { userId: 7, itemEditingId: 101 }, error,
        });
        expect(log.mock.calls[0][1].error).toBe(error);
        expect(f.json).toHaveBeenCalledOnce();
        expect(f.next).not.toHaveBeenCalled();
        if (error instanceof AppError) expect(error.statusCode).toBe(404);
    });
    it("C04: 送信例外は同一参照でnextへ渡しusecaseを再実行しない", async () => {
        const f = prepare(), error = new Error("send failed");
        f.json.mockImplementation(() => { throw error; });
        await f.run();
        expect(f.next).toHaveBeenCalledExactlyOnceWith(error);
        expect(f.next.mock.calls[0][0]).toBe(error);
        expect(mocks.convert).toHaveBeenCalledOnce();
    });
});
