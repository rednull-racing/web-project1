import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../../../usecases/itemDraft/getItemDraftList.js", () => ({ getItemDraftListUseCase: mocks.list }));
vi.mock("../../../usecases/itemDraft/createItemDraft.js", () => ({ createItemDraftUseCase: vi.fn() }));
vi.mock("../../../usecases/itemDraft/deleteItemDraft.js", () => ({ deleteItemDraftUseCase: vi.fn() }));
vi.mock("../../../usecases/itemDraft/convertItemDraftVideo.js", () => ({ convertItemDraftVideoUseCase: vi.fn() }));
vi.mock("../../../usecases/itemDraft/getItemDraftPage.js", () => ({ getItemDraftPageUseCase: vi.fn() }));
vi.mock("../../../usecases/itemDraft/getItemDraftPageMetadata.js", () => ({
    getItemDraftPageMetadataUseCase: vi.fn(),
}));
import { getItemDraftListController } from "../itemDraft.js";

const makeHttp = () => {
    const request: Partial<Request> = {
        user: { id: 7, email: "test@example.invalid", admin: false },
        validatedQuery: { page: 2, keyword: "シャツ" },
        query: { page: "99", keyword: "偽装", userId: "99", seller_id: "99" },
        body: { userId: 99 },
    };
    const req = request as Request;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;
    const next = vi.fn();
    return { status, json, next, run: () => getItemDraftListController(req, res, next) };
};
const deferred = () => {
    let resolve!: (value: { itemDraftList: []; totalPages: number }) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<{ itemDraftList: []; totalPages: number }>((ok, fail) => {
        resolve = ok;
        reject = fail;
    });
    return { promise, resolve, reject };
};
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());
describe("P0/P1 一覧controller", () => {
    it.each([{ itemDraftList: [] }, { itemDraftList: [{ itemDraft: { id: 123, name: null } }] }])(
        "C01: %jを200で返し認証ID・検証済みqueryのみ採用",
        async ({ itemDraftList }) => {
            const result = { itemDraftList, totalPages: itemDraftList.length ? 2 : 0 };
            mocks.list.mockResolvedValue(result);
            const http = makeHttp();
            await http.run();
            expect(mocks.list).toHaveBeenCalledExactlyOnceWith({ userId: 7, page: 2, keyword: "シャツ" });
            expect(http.status).toHaveBeenCalledExactlyOnceWith(200);
            expect(http.json).toHaveBeenCalledExactlyOnceWith(result);
            expect(http.next).not.toHaveBeenCalled();
        },
    );
    it.each([new Error("db"), new AppError("INTERNAL_ERROR", 500)])(
        "C02: %sを同じ参照でnextへ渡し成功応答なし",
        async (error) => {
            mocks.list.mockRejectedValue(error);
            const http = makeHttp();
            await http.run();
            expect(http.next).toHaveBeenCalledExactlyOnceWith(error);
            expect(http.status).not.toHaveBeenCalled();
            expect(http.json).not.toHaveBeenCalled();
        },
    );
    it.each(["resolve", "reject"] as const)("C03: usecaseの%s完了まで応答を待つ", async (outcome) => {
        const gate = deferred();
        mocks.list.mockReturnValue(gate.promise);
        const http = makeHttp();
        const pending = http.run();
        const error = new Error("deferred");
        try {
            expect(mocks.list).toHaveBeenCalledOnce();
            expect(http.status).not.toHaveBeenCalled();
            expect(http.json).not.toHaveBeenCalled();
            expect(http.next).not.toHaveBeenCalled();
        } finally {
            if (outcome === "resolve") gate.resolve({ itemDraftList: [], totalPages: 0 });
            else gate.reject(error);
            await pending;
        }
        if (outcome === "resolve")
            expect(http.json).toHaveBeenCalledExactlyOnceWith({ itemDraftList: [], totalPages: 0 });
        else {
            expect(http.next).toHaveBeenCalledExactlyOnceWith(error);
            expect(http.status).not.toHaveBeenCalled();
        }
    });
    it("C02: 応答送信失敗を伝播しusecaseを再実行しない", async () => {
        mocks.list.mockResolvedValue({ itemDraftList: [], totalPages: 0 });
        const http = makeHttp();
        const error = new Error("send");
        http.json.mockImplementation(() => {
            throw error;
        });
        await http.run();
        expect(http.next).toHaveBeenCalledExactlyOnceWith(error);
        expect(mocks.list).toHaveBeenCalledOnce();
    });
});
