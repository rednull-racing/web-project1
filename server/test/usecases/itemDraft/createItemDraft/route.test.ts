import { randomBytes } from "node:crypto";
import express, { type ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeBody } from "./fixtures.js";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../../src/usecases/itemDraft/createItemDraft.js", () => ({ createItemDraftUseCase: mocks.create }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
let app: ReturnType<typeof express>, secret: string;
const token = (id = 7, expiresIn = 3600) => jwt.sign({ id, email: "test@example.test", admin: false }, secret, { expiresIn });
const post = (body: object = makeBody(), userId = 7, suffix = "") => request(app).post(`/api/item-draft${suffix}`)
    .set("Authorization", `Bearer ${token(userId)}`).send(body);
beforeEach(async () => {
    vi.resetModules(); vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-12T00:00:00Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    secret = randomBytes(32).toString("hex"); vi.stubEnv("NEXTAUTH_SECRET", secret);
    const { default: router } = await import("../../../../src/routes/itemDraft.js");
    const { AppError } = await import("../../../../src/errors.js");
    app = express(); app.use(express.json()); app.use("/api/item-draft", router);
    // 共通errorHandlerの保証ではなく、Routerが渡す例外を観測する。
    const observe: ErrorRequestHandler = (err, _req, res, _next) => {
        if (err instanceof AppError) res.status(err.statusCode).json({ code: err.code });
        else res.status(500).json({ code: "TEST_UNEXPECTED_ERROR" });
    };
    app.use(observe);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("P0/P1: 実Routerの到達性と優先順位", () => {
    it.each(["なし", "Bearer不正", "署名不正", "期限切れ"])("R01 R06: トークン%sは401で停止", async (mode) => {
        const req = request(app).post("/api/item-draft");
        if (mode === "Bearer不正") req.set("Authorization", `Basic ${token()}`);
        if (mode === "署名不正") req.set("Authorization", `Bearer ${jwt.sign({ id: 7 }, "different-test-key")}`);
        if (mode === "期限切れ") req.set("Authorization", `Bearer ${token(7, -1)}`);
        const result = await req.send({});
        expect(result.status).toBe(401);
        expect(result.body).toEqual({ message: ["なし", "Bearer不正"].includes(mode) ? "トークンがありません。" : "トークンが無効です。" });
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it("R01: 未認証6回は認証済みユーザーの制限枠を消費しない", async () => {
        for (let i = 0; i < 6; i++) expect((await request(app).post("/api/item-draft").send({})).status).toBe(401);
        for (let i = 0; i < 5; i++) expect((await post()).status).toBe(400);
        expect((await post()).status).toBe(429); expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each([{ body: makeBody(), suffix: "" }, { body: {}, suffix: "" }, { body: { ...makeBody(), id: 11 }, suffix: "?id=11" }])(
        "R02 R03 O01: 正常認証でもparams不足が先に400となる $suffix", async ({ body, suffix }) => {
            const result = await post(body, 7, suffix);
            expect(result.status).toBe(400); expect(result.body).toEqual({ code: "INVALID_PARAMS" });
            expect(mocks.create).not.toHaveBeenCalled();
        });
    it("R04: 5回通過後6回目429、別ユーザーと10分窓更新後は再びparams400", async () => {
        for (let i = 0; i < 5; i++) expect((await post()).body).toEqual({ code: "INVALID_PARAMS" });
        expect((await post()).status).toBe(429);
        expect((await post(makeBody(), 8)).status).toBe(400);
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1);
        expect((await post()).body).toEqual({ code: "INVALID_PARAMS" }); expect(mocks.create).not.toHaveBeenCalled();
    });
    it("R05 R06: 不正入力も加算され6回目はvalidatorより先に429", async () => {
        for (let i = 0; i < 5; i++) expect((await post({})).body).toEqual({ code: "INVALID_PARAMS" });
        expect((await post()).status).toBe(429); expect((await post({})).status).toBe(429);
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it("R07: 存在しないid付きパスは404", async () => {
        expect((await post(makeBody(), 7, "/11")).status).toBe(404); expect(mocks.create).not.toHaveBeenCalled();
    });
});
