import "../../../../fixtures/items/createItem/httpMocks.js";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeHttpApp, makeToken, post as send } from "../../../../fixtures/items/createItem/httpFixtures.js";
let AppError: typeof import("../../../../../src/errors.js").AppError;
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../../../src/usecases/items/create/createItem.js", () => ({ createItemUseCase: mocks.create }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
let app: Awaited<ReturnType<typeof makeHttpApp>>, secret: string;
const post = (body: object = { itemEditingId: 11 }, id = 7) => send(app, secret, body, id);
beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    app = await makeHttpApp();
    AppError = (await import("../../../../../src/errors.js")).AppError;
    mocks.create.mockResolvedValue(456);
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});
describe("R 実認証・body・レート制限・共通errorHandler", () => {
    it.each([1, 2147483646, 2147483647])("R01 V01 V05: ID=%sと未知キー除去", async (itemEditingId) => {
        const result = await post({
            itemEditingId,
            userId: 88,
            seller_id: 88,
            status: "soldout",
            price: 1,
            attributes: {},
        });
        expect(result.status).toBe(201);
        expect(result.body).toEqual({ itemId: 456 });
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId });
    });
    it.each(["なし", "Bearerなし", "不正署名", "期限切れ"])("R02 R08: %sは不正bodyより先に401", async (mode) => {
        const req = request(app).post("/api/items");
        if (mode === "Bearerなし") req.set("Authorization", "Basic invalid");
        if (mode === "不正署名") req.set("Authorization", "Bearer " + makeToken("wrong"));
        if (mode === "期限切れ") req.set("Authorization", "Bearer " + makeToken(secret, 7, -1));
        const r = await req.send({});
        expect(r.status).toBe(401);
        expect(Object.keys(r.body)).toEqual(["message"]);
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each([
        {},
        { itemEditingId: 0 },
        { itemEditingId: -1 },
        { itemEditingId: 2147483648 },
        { itemEditingId: 1.5 },
        { itemEditingId: null },
        { itemEditingId: "11" },
        { itemEditingId: [] },
        { itemEditingId: {} },
    ])("R07 V02 V03: body=%jはINVALID_BODY", async (body) => {
        const r = await post(body);
        expect(r.status).toBe(400);
        expect(r.body).toEqual({ code: "INVALID_BODY", message: "INVALID_BODY" });
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each(['{"itemEditingId":', "1", '"text"'])("R06 R08: raw JSON=%sを認証前に拒否し枠を消費しない", async (raw) => {
        const r = await request(app).post("/api/items").set("Content-Type", "application/json").send(raw);
        expect(r.status).toBe(400);
        expect(r.body.code).toBe("INVALID_JSON");
        for (let i = 0; i < 5; i++) expect((await post()).status).toBe(201);
        expect(mocks.create).toHaveBeenCalledTimes(5);
    });
    it("R10: queryではbodyを補完せず、正常bodyを優先", async () => {
        const token = "Bearer " + makeToken(secret);
        const a = await request(app).post("/api/items?itemEditingId=11").set("Authorization", token).send({});
        expect(a.status).toBe(400);
        const b = await request(app)
            .post("/api/items?itemEditingId=999")
            .set("Authorization", token)
            .send({ itemEditingId: 11 });
        expect(b.status).toBe(201);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: 11 });
    });
    it.each([400, 404, 500])("R09 R11: %sの業務失敗も消費し6回目429", async (status) => {
        mocks.create.mockRejectedValue(
            status === 500
                ? new Error("private SQL")
                : new AppError(status === 404 ? "ITEM_EDITING_NOT_FOUND" : "VIDEO_URL_NULL", status),
        );
        for (let i = 0; i < 5; i++) {
            const r = await post();
            expect(r.status).toBe(status);
            if (status === 500)
                expect(r.body).toEqual({ error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
            expect(JSON.stringify(r.body)).not.toContain("private SQL");
        }
        expect((await post()).status).toBe(429);
        expect(mocks.create).toHaveBeenCalledTimes(5);
    });
    it("R03 R04 R08 R13: 5回枠・ユーザーキー・標準ヘッダー・認証拒否非消費", async () => {
        for (let i = 0; i < 6; i++) expect((await request(app).post("/api/items").send({})).status).toBe(401);
        for (let i = 0; i < 5; i++) expect((await post()).status).toBe(201);
        const r = await post({});
        expect(r.status).toBe(429);
        expect(r.headers["retry-after"]).toBeDefined();
        expect(Object.keys(r.headers).some((k) => k.startsWith("ratelimit"))).toBe(true);
        expect(Object.keys(r.headers).some((k) => k.startsWith("x-ratelimit"))).toBe(false);
        expect((await send(app, secret, { itemEditingId: 11 }, 8)).status).toBe(201);
        expect(
            (
                await request(app)
                    .post("/api/items")
                    .set("X-Forwarded-For", "192.0.2.10")
                    .set("Authorization", "Bearer " + makeToken(secret))
                    .send({ itemEditingId: 11, userId: 8 })
            ).status,
        ).toBe(429);
    });
    it("R07: 不正body5回が枠を消費し6回目は429", async () => {
        for (let i = 0; i < 5; i++) expect((await post({})).status).toBe(400);
        expect((await post()).status).toBe(429);
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each([599999, 600000, 600001])("R05: 窓%s msの境界", async (elapsed) => {
        for (let i = 0; i < 5; i++) await post();
        await vi.advanceTimersByTimeAsync(elapsed);
        expect((await post()).status).toBe(elapsed < 600000 ? 429 : 201);
    });
    it("R11: 属性構造のAppError500を既存形式で返す", async () => {
        mocks.create.mockRejectedValue(new AppError("ITEM_ATTRIBUTES_INVALID", 500, "公開メッセージ"));
        const r = await post();
        expect(r.status).toBe(500);
        expect(r.body).toEqual({ code: "ITEM_ATTRIBUTES_INVALID", message: "公開メッセージ" });
    });
    it("R12: 旧PATCH公開ルートなし", async () => {
        expect((await request(app).patch("/api/items/11/publish").send({})).status).toBe(404);
        expect(mocks.create).not.toHaveBeenCalled();
    });
});
it("R13: schema拒否2回→認証拒否→schema拒否3回→6回目429", async () => {
    for (let i = 0; i < 2; i++) expect((await post({})).status).toBe(400);
    expect((await request(app).post("/api/items").send({})).status).toBe(401);
    for (let i = 0; i < 3; i++) expect((await post({})).status).toBe(400);
    expect((await post()).status).toBe(429);
    expect(mocks.create).not.toHaveBeenCalled();
});
it.each(["配列", "空body"])("V04 R07: %sをINVALID_BODYで拒否", async (mode) => {
    const req = request(app)
        .post("/api/items")
        .set("Authorization", "Bearer " + makeToken(secret));
    const result = mode === "配列" ? await req.send([]) : await req.send();
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("INVALID_BODY");
    expect(mocks.create).not.toHaveBeenCalled();
});
