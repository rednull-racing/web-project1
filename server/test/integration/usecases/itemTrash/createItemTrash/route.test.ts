import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 認証結果と業務処理だけを置換し、DB初期化を遮断する。
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../../../src/usecases/itemTrash/createItemTrash.js", () => ({
    createItemTrashUseCase: mocks.create,
}));
vi.mock("../../../../../src/usecases/itemTrash/getItemTrashList.js", () => ({
    getItemTrashListUseCase: vi.fn().mockResolvedValue({ itemTrashList: [], totalPages: 0 }),
}));
vi.mock("../../../../../src/middleware/authMiddleware.js", () => ({
    authenticateToken: (req: Request, res: Response, next: NextFunction) => {
        const id = Number(req.headers["x-test-user"]);
        if (!Number.isInteger(id) || id < 1) {
            res.status(401).json({ message: "認証が必要です" });
            return;
        }
        req.user = { id, email: "http-test@example.invalid", admin: false };
        next();
    },
}));

let app: express.Express;
let AppError: typeof import("../../../../../src/errors.js").AppError;
const post = (body: object = { itemId: 123 }, userId = 7) =>
    request(app).post("/api/item-trash").set("X-Test-User", String(userId)).send(body);

beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-11-05T00:00:00Z"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { default: router } = await import("../../../../../src/routes/itemTrash.js");
    const { errorHandler } = await import("../../../../../src/middleware/errorHandler.js");
    AppError = (await import("../../../../../src/errors.js")).AppError;
    app = express();
    app.use(express.json());
    app.use("/api/item-trash", router);
    app.use(errorHandler);
    mocks.create.mockResolvedValue(undefined);
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("P0 HTTP接続・検証済み入力・公開応答（認証結果とusecaseはモック）", () => {
    it.each([1, 2147483646, 2147483647])("HTTP-01: itemId=%sを認証本人のIDと渡して201", async (itemId) => {
        const r = await post({ itemId, userId: 88, seller_id: 99, status: "soldout" });
        expect(r.status).toBe(201);
        expect(r.body).toEqual({ message: "商品を削除しました" });
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemId });
    });
    it.each([
        {},
        { itemId: null },
        { itemId: "123" },
        { itemId: 0 },
        { itemId: -1 },
        { itemId: 1.5 },
        { itemId: 2147483648 },
        { itemId: [] },
        { itemId: {} },
        [],
    ])("HTTP-02: body=%jは400・usecase未実行", async (body) => {
        const r = await post(body);
        expect(r.status).toBe(400);
        expect(r.body).toEqual({ code: "INVALID_BODY", message: "INVALID_BODY" });
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it("HTTP-03: bodyなし・queryだけではitemIdを補完しない", async () => {
        const r = await request(app).post("/api/item-trash?itemId=123").set("X-Test-User", "7");
        expect(r.status).toBe(400);
        expect(r.body.code).toBe("INVALID_BODY");
        expect(mocks.create).not.toHaveBeenCalled();
        expect(
            (await request(app).post("/api/item-trash?itemId=999").set("X-Test-User", "7").send({ itemId: 123 }))
                .status,
        ).toBe(201);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemId: 123 });
    });
    it("HTTP-04: 認証拒否はschemaより先・レート枠を消費しない", async () => {
        for (let i = 0; i < 11; i++) expect((await request(app).post("/api/item-trash").send({})).status).toBe(401);
        expect(mocks.create).not.toHaveBeenCalled();
        for (let i = 0; i < 10; i++) expect((await post()).status).toBe(201);
    });
    it.each(['{"itemId":', "1", '"text"'])("HTTP-05: raw JSON=%sは認証前に400・枠非消費", async (raw) => {
        const r = await request(app).post("/api/item-trash").set("Content-Type", "application/json").send(raw);
        expect(r.status).toBe(400);
        expect(r.body).toEqual({ code: "INVALID_JSON", message: "JSONの形式を確認してください。" });
        expect(mocks.create).not.toHaveBeenCalled();
        for (let i = 0; i < 10; i++) expect((await post()).status).toBe(201);
    });
    it.each([404, 500])("HTTP-06: 業務例外%sの公開応答・内部情報非公開", async (status) => {
        mocks.create.mockRejectedValue(
            status === 404 ? new AppError("ITEM_NOT_FOUND", 404) : new Error("private SQL marker"),
        );
        const r = await post();
        expect(r.status).toBe(status);
        expect(r.body).toEqual(
            status === 404
                ? { code: "ITEM_NOT_FOUND", message: "ITEM_NOT_FOUND" }
                : { error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" },
        );
        expect(JSON.stringify(r.body)).not.toContain("private SQL marker");
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemId: 123 });
    });
    it("HTTP-07: usecase完了まで成功応答を送信しない", async () => {
        let release!: () => void;
        let entered!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const started = new Promise<void>((resolve) => {
            entered = resolve;
        });
        mocks.create.mockImplementation(async () => {
            entered();
            await gate;
        });
        let finished = false;
        const pending = post().then((result) => {
            finished = true;
            return result;
        });
        try {
            await started;
            expect(finished).toBe(false);
        } finally {
            release();
            expect((await pending).status).toBe(201);
        }
    });
});

describe("P0 実rateLimitのユーザー枠・優先順・時間境界", () => {
    it("HTTP-08: 10回許可・11回目429、別ユーザーは別枠、対象変更でも同一枠", async () => {
        for (let i = 0; i < 10; i++) expect((await post({ itemId: i + 1 })).status).toBe(201);
        const r = await post({ itemId: 999 });
        expect(r.status).toBe(429);
        expect(r.headers["retry-after"]).toBeDefined();
        expect(Object.keys(r.headers).some((key) => key.startsWith("ratelimit"))).toBe(true);
        expect(Object.keys(r.headers).some((key) => key.startsWith("x-ratelimit"))).toBe(false);
        expect((await post({ itemId: 999 }, 8)).status).toBe(201);
        expect(mocks.create).toHaveBeenCalledTimes(11);
    });
    it("HTTP-09: 不正bodyも枠を消費し、超過時はschemaより先に429", async () => {
        for (let i = 0; i < 10; i++) expect((await post({})).status).toBe(400);
        expect((await post({})).status).toBe(429);
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it("HTTP-10: 業務失敗も枠を消費する", async () => {
        mocks.create.mockRejectedValue(new AppError("ITEM_NOT_FOUND", 404));
        for (let i = 0; i < 10; i++) expect((await post()).status).toBe(404);
        expect((await post()).status).toBe(429);
        expect(mocks.create).toHaveBeenCalledTimes(10);
    });
    it.each([599999, 600000, 600001])("HTTP-11: 窓の%s ms境界で再開", async (elapsed) => {
        for (let i = 0; i < 10; i++) expect((await post()).status).toBe(201);
        await vi.advanceTimersByTimeAsync(elapsed);
        expect((await post()).status).toBe(elapsed < 600000 ? 429 : 201);
    });
});
