import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";
import { deferred, makeMetadata } from "../../../../test/fixtures/itemEditing/getItemConfirmPageMetadata/fixtures.js";
const mocks = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn() }));
vi.mock("../../../usecases/itemEditing/getItemConfirmPageMetadata.js", () => ({
    getItemConfirmPageMetadataUseCase: mocks.get,
}));
vi.mock("../../../usecases/itemEditing/getItemConfirmPage.js", () => ({ getItemConfirmPageUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/convertItemEditingVideo.js", () => ({
    convertItemEditingVideoUseCase: vi.fn(),
}));
vi.mock("../../../usecases/itemEditing/createItemEditing.js", () => ({ createItemEditingUseCase: mocks.create }));
vi.mock("../../../usecases/itemEditing/createItemEditingDraft.js", () => ({ createItemEditingDraftUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/updateConfirm.js", () => ({ updateItemEditingConfirmUseCase: vi.fn() }));
vi.mock("../../../usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.js", () => ({
    createItemEditingCopyUseCase: vi.fn(),
}));
import { getItemConfirmPageMetadataController } from "../itemEditing.js";
const prepare = () => {
    const req = {
        user: { id: 7 },
        validatedParams: { id: 101 },
        params: { id: "999" },
        body: { userId: 8, seller_id: 8, id: 888 },
        query: { userId: "8", id: "777" },
    } as unknown as Request;
    const json = vi.fn(),
        status = vi.fn().mockReturnValue({ json }),
        next = vi.fn();
    const res = { status, json } as unknown as Response;
    return { req, res, status, json, next, run: () => getItemConfirmPageMetadataController(req, res, next) };
};
beforeEach(() => {
    vi.resetAllMocks();
    mocks.get.mockResolvedValue(makeMetadata());
});
describe("P0/P1: getItemConfirmPageMetadata controller", () => {
    it("C01: 検証済みIDと認証所有者だけを渡し200を返す", async () => {
        const f = prepare();
        expect(await f.run()).toBeUndefined();
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 101, userId: 7 });
        expect(f.status).toHaveBeenCalledExactlyOnceWith(200);
        expect(f.json).toHaveBeenCalledExactlyOnceWith({ itemEditing: makeMetadata() });
        expect(f.next).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each([new AppError("ITEM_EDITING_NOT_FOUND", 404), new Error("db")])(
        "C02: %sを同じ参照でnextへ渡す",
        async (error) => {
            mocks.get.mockRejectedValue(error);
            const f = prepare();
            await f.run();
            expect(f.next).toHaveBeenCalledExactlyOnceWith(error);
            expect(f.next.mock.calls[0][0]).toBe(error);
            expect(f.status).not.toHaveBeenCalled();
            expect(f.json).not.toHaveBeenCalled();
        },
    );
    it.each(["成功", "失敗"])("C03: usecase%sまで応答しない", async (mode) => {
        const gate = deferred<ReturnType<typeof makeMetadata>>(),
            error = new Error("保留失敗");
        mocks.get.mockReturnValue(gate.promise);
        const f = prepare(),
            pending = f.run();
        try {
            expect(mocks.get).toHaveBeenCalledOnce();
            expect(f.status).not.toHaveBeenCalled();
            expect(f.json).not.toHaveBeenCalled();
            expect(f.next).not.toHaveBeenCalled();
        } finally {
            if (mode === "成功") gate.resolve(makeMetadata());
            else gate.reject(error);
            await pending;
        }
        if (mode === "成功") expect(f.json).toHaveBeenCalledExactlyOnceWith({ itemEditing: makeMetadata() });
        else {
            expect(f.next).toHaveBeenCalledExactlyOnceWith(error);
            expect(f.json).not.toHaveBeenCalled();
        }
    });
    it("C04: 送信失敗後にusecaseを再実行しない", async () => {
        const f = prepare(),
            error = new Error("送信失敗");
        f.json.mockImplementation(() => {
            throw error;
        });
        await f.run();
        expect(f.next).toHaveBeenCalledExactlyOnceWith(error);
        expect(mocks.get).toHaveBeenCalledOnce();
        expect(mocks.create).not.toHaveBeenCalled();
    });
});

vi.mock("../../../usecases/itemEditing/getItemEditingForm.js", () => ({
    getItemEditingFormUseCase: vi.fn(),
}));
