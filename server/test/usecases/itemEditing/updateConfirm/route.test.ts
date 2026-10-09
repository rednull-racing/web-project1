import { randomBytes } from "node:crypto";
import express, { type ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeBody, makeDuplicateUiIdBody, variantImageStates } from "./fixtures.js";
const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../../../../src/usecases/itemEditing/updateConfirm.js", () => ({
    updateItemEditingConfirmUseCase: mocks.update,
}));
vi.mock("../../../../src/usecases/itemEditing/createItemEditing.js", () => ({ createItemEditingUseCase: vi.fn() }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
let app: ReturnType<typeof express>;
let secret: string;
const response = {
    videoSignedUrl: null,
    thumbnailSignedUrl: null,
    itemImageSignedUrls: [],
    attributesImageSignedUrls: {},
};
const token = (id = 7, expiresIn = 3600) =>
    jwt.sign({ id, email: "test@example.test", admin: false }, secret, { expiresIn });
const put = (body: object = makeBody(), id = "11", userId = 7) =>
    request(app)
        .put(`/api/item-editing/${id}`)
        .set("Authorization", `Bearer ${token(userId)}`)
        .send(body);
beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    // HTTPのI/Oは実行し、時間窓とストアのintervalだけを制御する。
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-09T00:00:00Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    const { default: router } = await import("../../../../src/routes/itemEditing.js");
    const { AppError } = await import("../../../../src/errors.js");
    app = express();
    app.use(express.json());
    app.use("/api/item-editing", router);
    // 実アプリ共通handlerとは独立した、Routerが渡した例外の観測用handler。
    const observeError: ErrorRequestHandler = (err, _req, res, _next) => {
        if (err instanceof AppError) res.status(err.statusCode).json({ code: err.code });
        else res.status(500).json({ code: "TEST_UNEXPECTED_ERROR" });
    };
    app.use(observeError);
    mocks.update.mockResolvedValue(response);
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe("P1: 実Router・認証・validatorの接続（usecaseのみモック）", () => {
    it("R01 R02 R08 V14: 認証ユーザーと未知キー除去後のbodyを使用して200を返す", async () => {
        const res = await put({ ...makeBody(), userId: 8, seller_id: 8, status: "published" });
        expect(res.status).toBe(200);
        expect(res.body).toEqual(response);
        expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 11, userId: 7, body: makeBody() });
    });
    it.each(["なし", "不正", "期限切れ"])("R04: トークン%sでは401となりusecaseを呼ばない", async (mode) => {
        const req = request(app).put("/api/item-editing/11");
        if (mode !== "なし") req.set("Authorization", `Bearer ${mode === "不正" ? "invalid-token" : token(7, -1)}`);
        const res = await req.send(makeBody());
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ message: mode === "なし" ? "トークンがありません。" : "トークンが無効です。" });
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it.each([
        ["abc", true, "INVALID_PARAMS"],
        ["11", false, "INVALID_BODY"],
        ["abc", false, "INVALID_PARAMS"],
    ] as const)("R05: id=%s/body正常=%sで%sとなりusecaseを呼ばない", async (id, valid, code) => {
        const res = await put(valid ? makeBody() : {}, id);
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ code });
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it("R06 Q06: 5回通過・6回目429、別ユーザーは別枠、10分経過後に再開する", async () => {
        for (let i = 0; i < 5; i++) expect((await put()).status).toBe(200);
        const limited = await put();
        expect(limited.status).toBe(429);
        expect(mocks.update).toHaveBeenCalledTimes(5);
        expect((await put(makeBody(), "12", 8)).status).toBe(200);
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1);
        expect((await put()).status).toBe(200);
        expect(mocks.update).toHaveBeenCalledTimes(7);
    });
    it("R07: 不正bodyも制限回数へ加算され6回目はvalidatorより先に429になる", async () => {
        for (let i = 0; i < 5; i++) {
            const res = await put({});
            expect(res.status).toBe(400);
            expect(res.body.code).toBe("INVALID_BODY");
        }
        expect((await put({})).status).toBe(429);
        expect(mocks.update).not.toHaveBeenCalled();
    });
});

describe("F3/F4: 実Routerのエラー接続", () => {
    it("AF-I06: usecaseのITEM_IMAGE_NULLを400で引き渡す", async () => {
        const { AppError } = await import("../../../../src/errors.js");
        mocks.update.mockRejectedValue(new AppError("ITEM_IMAGE_NULL", 400));
        const result = await put();
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ code: "ITEM_IMAGE_NULL" });
        expect(mocks.update).toHaveBeenCalledOnce();
    });
    describe.each(variantImageStates)("AF-V01 P07 O04: 先頭画像=%s", (first) => {
        it.each(variantImageStates)("後続画像=%sの重複uiIdは400でusecaseへ進めない", async (second) => {
            const result = await put(makeDuplicateUiIdBody(first, second));
            expect(result.status).toBe(400);
            expect(result.body).toEqual({ code: "INVALID_BODY" });
            expect(mocks.update).not.toHaveBeenCalled();
        });
    });
    it("AF-V04: params不正は重複uiIdより先に拒否する", async () => {
        const result = await put(makeDuplicateUiIdBody(), "abc");
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ code: "INVALID_PARAMS" });
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it("AF-V04: 未認証は重複uiIdの検証より先に401となる", async () => {
        const result = await request(app).put("/api/item-editing/11").send(makeDuplicateUiIdBody());
        expect(result.status).toBe(401);
        expect(result.body).toEqual({ message: "トークンがありません。" });
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it("AF-V04: 重複uiIdの不正bodyも5回で制限に達し6回目は429になる", async () => {
        for (let index = 0; index < 5; index++) {
            const result = await put(makeDuplicateUiIdBody());
            expect(result.status).toBe(400);
            expect(result.body.code).toBe("INVALID_BODY");
        }
        expect((await put(makeDuplicateUiIdBody())).status).toBe(429);
        expect(mocks.update).not.toHaveBeenCalled();
    });
});
