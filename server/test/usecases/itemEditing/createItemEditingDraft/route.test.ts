import { randomBytes } from "node:crypto";
import express from "express";
import type { ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidIds, makeBody } from "./fixtures.js";

const mocks = vi.hoisted(() => ({ create: vi.fn(), observe: vi.fn() }));
vi.mock("../../../../src/usecases/itemEditing/createItemEditingDraft.js", () => ({ createItemEditingDraftUseCase: mocks.create }));
vi.mock("../../../../src/usecases/itemEditing/createItemEditing.js", () => ({ createItemEditingUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/itemEditing/updateConfirm.js", () => ({ updateItemEditingConfirmUseCase: vi.fn() }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));

let app: ReturnType<typeof express>, commonApp: ReturnType<typeof express>, secret: string;
const token = (id = 7, expiresIn = 3600, key = secret) => jwt.sign({ id, email: "test@example.test", admin: false }, key, { expiresIn });
const post = (body: object = makeBody(), id = 7) => request(app)
    .post("/api/item-editing/draft").set("Authorization", `Bearer ${token(id)}`).send(body);
beforeEach(async () => {
    vi.resetModules(); vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-13T00:00:00Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    const { default: router } = await import("../../../../src/routes/itemEditing.js");
    const { AppError } = await import("../../../../src/errors.js");
    const { errorHandler } = await import("../../../../src/middleware/errorHandler.js");
    commonApp = express(); commonApp.use(express.json()); commonApp.use("/api/item-editing", router);
    expect(errorHandler.length).toBe(4);
    commonApp.use(errorHandler);
    app = express(); app.use(express.json()); app.use("/api/item-editing", router);
    // エラーの到達観測用。共通errorHandlerのHTTP保証ではない。
    const observe: ErrorRequestHandler = (error, _req, res, _next) => {
        void _req;
        void _next;
        mocks.observe(error);
        if (error instanceof AppError) res.status(error.statusCode).json({ code: error.code });
        else res.status(500).json({ code: "TEST_UNEXPECTED_ERROR" });
    };
    expect(observe.length).toBe(4);
    app.use(observe); mocks.create.mockResolvedValue(456);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("P1: 実Routerと実共通errorHandlerの接続", () => {
    const send = (body: object = makeBody()) => request(commonApp)
        .post("/api/item-editing/draft").set("Authorization", `Bearer ${token()}`).send(body);
    it.each(invalidIds)("AF-R01: ID=$nameは共通handlerから400のJSONを返しusecase未実行", async ({ value }) => {
        const result = await send({ itemDraftId: value });
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ code: "INVALID_BODY", message: "INVALID_BODY" });
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.observe).not.toHaveBeenCalled();
    });
    it("AF-R02: ITEM_DRAFT_NOT_FOUNDは共通handlerから404のJSONを返す", async () => {
        const { AppError } = await import("../../../../src/errors.js");
        mocks.create.mockRejectedValue(new AppError("ITEM_DRAFT_NOT_FOUND", 404));
        const result = await send();
        expect(result.status).toBe(404);
        expect(result.body).toEqual({ code: "ITEM_DRAFT_NOT_FOUND", message: "ITEM_DRAFT_NOT_FOUND" });
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemDraftId: 11 });
        expect(mocks.observe).not.toHaveBeenCalled();
    });
    it("AF-R03: 通常Errorは内部詳細を含まない500のJSONを返す", async () => {
        mocks.create.mockRejectedValue(new Error("DB failure: private detail"));
        const result = await send();
        expect(result.status).toBe(500);
        expect(result.body).toEqual({ error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemDraftId: 11 });
        expect(mocks.observe).not.toHaveBeenCalled();
    });
    it("AF-R04: 正常要求は201とitemEditingIdを維持する", async () => {
        const result = await send();
        expect(result.status).toBe(201);
        expect(result.body).toEqual({ itemEditingId: 456 });
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemDraftId: 11 });
        expect(mocks.observe).not.toHaveBeenCalled();
    });
});

describe("P1: 実Routerの認証・入力・201接続", () => {
    it("R02 C02 V05: 実パスで検証済みIDと認証所有者を渡し201を返す", async () => {
        const result = await post({ ...makeBody(), seller_id: 8, userId: 8 });
        expect(result.status).toBe(201); expect(result.body).toEqual({ itemEditingId: 456 });
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemDraftId: 11 });
    });
    it.each(["なし", "Bearer不正", "形式不正", "署名不正", "期限切れ"] as const)("R01 R07: %sは401、レート枠を消費しない", async (mode) => {
        const req = request(app).post("/api/item-editing/draft");
        if (mode === "Bearer不正") req.set("Authorization", `Basic ${token()}`);
        if (mode === "形式不正") req.set("Authorization", "Bearer invalid-token");
        if (mode === "署名不正") req.set("Authorization", `Bearer ${token(7, 3600, "other-test-secret")}`);
        if (mode === "期限切れ") req.set("Authorization", `Bearer ${token(7, -1)}`);
        const result = await req.send({ itemDraftId: "invalid" });
        expect(result.status).toBe(401);
        expect(result.body).toEqual({ message: mode === "なし" || mode === "Bearer不正" ? "トークンがありません。" : "トークンが無効です。" });
        expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.observe).not.toHaveBeenCalled();
        for (let i = 0; i < 5; i++) expect((await post()).status).toBe(201);
        expect((await post()).status).toBe(429);
        expect(mocks.create).toHaveBeenCalledTimes(5);
    });
    it.each(invalidIds)("R03 V02 V03: ID=$nameは400となりusecase未実行", async ({ value }) => {
        const result = await post({ itemDraftId: value });
        expect(result.status).toBe(400); expect(result.body).toEqual({ code: "INVALID_BODY" });
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each([1, 2, 11])("V01 R02: 正整数ID=%sを同じ値で引き渡す", async (id) => {
        expect((await post(makeBody(id))).status).toBe(201);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemDraftId: id });
    });
    it.each(["AppError", "通常Error"] as const)("R08 AF-R05: %sを同じ参照で4引数のエラーmiddlewareへ渡す", async (mode) => {
        const { AppError } = await import("../../../../src/errors.js");
        const error = mode === "AppError" ? new AppError("ITEM_DRAFT_NOT_FOUND", 404) : new Error("DB failure");
        mocks.create.mockRejectedValue(error);
        const result = await post();
        expect(result.status).toBe(mode === "AppError" ? 404 : 500);
        expect(result.body).toEqual({ code: mode === "AppError" ? "ITEM_DRAFT_NOT_FOUND" : "TEST_UNEXPECTED_ERROR" });
        expect(mocks.observe).toHaveBeenCalledExactlyOnceWith(error);
        expect(mocks.observe.mock.calls[0][0]).toBe(error);
    });
});
describe("P1: ユーザー単位の回数・時間窓境界", () => {
    it("R04: 同一ユーザーの異なるトークンでも5回/6回を共有し別ユーザーは別枠", async () => {
        for (let i = 0; i < 5; i++) {
            const res = await request(app).post("/api/item-editing/draft")
                .set("Authorization", `Bearer ${jwt.sign({ id: 7, jti: String(i) }, secret, { expiresIn: 3600 })}`).send(makeBody());
            expect(res.status).toBe(201);
        }
        expect((await post()).status).toBe(429); expect(mocks.create).toHaveBeenCalledTimes(5);
        expect((await post(makeBody(), 8)).status).toBe(201); expect(mocks.create).toHaveBeenCalledTimes(6);
    });
    it.each([true, false])("R05 R07: 5回の不正body後、6回目のbody正常=%sでも429が優先", async (valid) => {
        for (let i = 0; i < 5; i++) {
            const res = await post({}); expect(res.status).toBe(400); expect(res.body).toEqual({ code: "INVALID_BODY" });
        }
        mocks.observe.mockClear();
        expect((await post(valid ? makeBody() : {})).status).toBe(429);
        expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.observe).not.toHaveBeenCalled();
    });
    it.each([599999, 600000, 600001])("R06: 初回から%smsの時間窓境界で通過/超過が切り替わる", async (elapsed) => {
        for (let i = 0; i < 5; i++) expect((await post()).status).toBe(201);
        await vi.advanceTimersByTimeAsync(elapsed);
        expect((await post()).status).toBe(elapsed < 600000 ? 429 : 201);
        expect(mocks.create).toHaveBeenCalledTimes(elapsed < 600000 ? 5 : 6);
    });
});
