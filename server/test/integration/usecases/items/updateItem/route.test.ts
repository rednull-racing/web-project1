import "../../../../fixtures/items/updateItem/httpMocks.js";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeHttpApp, makeToken, put as send } from "../../../../fixtures/items/updateItem/httpFixtures.js";
let AppError: typeof import("../../../../../src/errors.js").AppError;
const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("../../../../../src/usecases/items/update/updateItem.js", () => ({ updateItemUseCase: mocks.update }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
let app: Awaited<ReturnType<typeof makeHttpApp>>, secret: string;
const put = (body: object = { itemEditingId: 11 }, id = 7) => send(app, secret, body, id);
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
    mocks.update.mockResolvedValue(456);
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});
describe("H 実認証・body・レート制限・共通errorHandler", () => {
    it.each([1, 2147483646, 2147483647])("H01 V01: ID=%sと未知キー除去", async (itemEditingId) => {
        const result = await put({
            itemEditingId,
            userId: 88,
            seller_id: 88,
            status: "soldout",
            price: 1,
            attributes: {},
        });
        expect(result.status).toBe(201);
        expect(result.body).toEqual({ itemId: 456 });
        expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId });
    });
    it.each(["なし", "Bearerなし", "不正署名", "期限切れ"])("H02: %sは不正bodyより先に401", async (mode) => {
        const req = request(app).put("/api/items");
        if (mode === "Bearerなし") req.set("Authorization", "Basic invalid");
        if (mode === "不正署名") req.set("Authorization", "Bearer " + makeToken("wrong"));
        if (mode === "期限切れ") req.set("Authorization", "Bearer " + makeToken(secret, 7, -1));
        const r = await req.send({});
        expect(r.status).toBe(401);
        expect(Object.keys(r.body)).toEqual(["message"]);
        expect(mocks.update).not.toHaveBeenCalled();
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
    ])("H01 V01: body=%jはINVALID_BODY", async (body) => {
        const r = await put(body);
        expect(r.status).toBe(400);
        expect(r.body).toEqual({ code: "INVALID_BODY", message: "INVALID_BODY" });
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it.each(['{"itemEditingId":', "1", '"text"'])("H02: raw JSON=%sを認証前に拒否し枠を消費しない", async (raw) => {
        const r = await request(app).put("/api/items").set("Content-Type", "application/json").send(raw);
        expect(r.status).toBe(400);
        expect(r.body.code).toBe("INVALID_JSON");
        for (let i = 0; i < 5; i++) expect((await put()).status).toBe(201);
        expect(mocks.update).toHaveBeenCalledTimes(5);
    });
    it("H01: queryではbodyを補完せず、正常bodyを優先", async () => {
        const token = "Bearer " + makeToken(secret);
        const a = await request(app).put("/api/items?itemEditingId=11").set("Authorization", token).send({});
        expect(a.status).toBe(400);
        const b = await request(app)
            .put("/api/items?itemEditingId=999")
            .set("Authorization", token)
            .send({ itemEditingId: 11 });
        expect(b.status).toBe(201);
        expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: 11 });
    });
    it.each([400, 404, 500])("H02: %sの業務失敗も消費し6回目429", async (status) => {
        mocks.update.mockRejectedValue(
            status === 500
                ? new Error("private SQL")
                : new AppError(status === 404 ? "ITEM_EDITING_NOT_FOUND" : "VIDEO_URL_NULL", status),
        );
        for (let i = 0; i < 5; i++) {
            const r = await put();
            expect(r.status).toBe(status);
            if (status === 500)
                expect(r.body).toEqual({ error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
            expect(JSON.stringify(r.body)).not.toContain("private SQL");
        }
        expect((await put()).status).toBe(429);
        expect(mocks.update).toHaveBeenCalledTimes(5);
    });
    it("H02: 5回枠・ユーザーキー・標準ヘッダー・認証拒否非消費", async () => {
        for (let i = 0; i < 6; i++) expect((await request(app).put("/api/items").send({})).status).toBe(401);
        for (let i = 0; i < 5; i++) expect((await put()).status).toBe(201);
        const r = await put({});
        expect(r.status).toBe(429);
        expect(r.headers["retry-after"]).toBeDefined();
        expect(Object.keys(r.headers).some((k) => k.startsWith("ratelimit"))).toBe(true);
        expect(Object.keys(r.headers).some((k) => k.startsWith("x-ratelimit"))).toBe(false);
        expect((await send(app, secret, { itemEditingId: 11 }, 8)).status).toBe(201);
        expect(
            (
                await request(app)
                    .put("/api/items")
                    .set("X-Forwarded-For", "192.0.2.10")
                    .set("Authorization", "Bearer " + makeToken(secret))
                    .send({ itemEditingId: 11, userId: 8 })
            ).status,
        ).toBe(429);
    });
    it("H02: 不正body5回が枠を消費し6回目は429", async () => {
        for (let i = 0; i < 5; i++) expect((await put({})).status).toBe(400);
        expect((await put()).status).toBe(429);
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it.each([599999, 600000, 600001])("H02: 窓%s msの境界", async (elapsed) => {
        for (let i = 0; i < 5; i++) await put();
        await vi.advanceTimersByTimeAsync(elapsed);
        expect((await put()).status).toBe(elapsed < 600000 ? 429 : 201);
    });
    it("H02: 属性構造のAppError500を既存形式で返す", async () => {
        mocks.update.mockRejectedValue(new AppError("ITEM_ATTRIBUTES_INVALID", 500, "公開メッセージ"));
        const r = await put();
        expect(r.status).toBe(500);
        expect(r.body).toEqual({ code: "ITEM_ATTRIBUTES_INVALID", message: "公開メッセージ" });
    });
    it("H01: 旧PATCH公開ルートなし", async () => {
        expect((await request(app).patch("/api/items/11/publish").send({})).status).toBe(404);
        expect(mocks.update).not.toHaveBeenCalled();
    });
});
it("H02: schema拒否2回→認証拒否→schema拒否3回→6回目429", async () => {
    for (let i = 0; i < 2; i++) expect((await put({})).status).toBe(400);
    expect((await request(app).put("/api/items").send({})).status).toBe(401);
    for (let i = 0; i < 3; i++) expect((await put({})).status).toBe(400);
    expect((await put()).status).toBe(429);
    expect(mocks.update).not.toHaveBeenCalled();
});
it.each(["配列", "空body"])("H01 V01: %sをINVALID_BODYで拒否", async (mode) => {
    const req = request(app)
        .put("/api/items")
        .set("Authorization", "Bearer " + makeToken(secret));
    const result = mode === "配列" ? await req.send([]) : await req.send();
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("INVALID_BODY");
    expect(mocks.update).not.toHaveBeenCalled();
});

it.each(["POST先行", "PUT先行"])("H02: %sでもPOSTとPUTのレート枠は独立", async (order) => {
    const { createItemUseCase } = await import("../../../../../src/usecases/items/create/createItem.js");
    vi.mocked(createItemUseCase).mockResolvedValue(700);
    const post = () =>
        request(app)
            .post("/api/items")
            .set("Authorization", "Bearer " + makeToken(secret))
            .send({ itemEditingId: 21 });
    const first = order === "POST先行" ? post : () => put();
    const second = order === "POST先行" ? () => put() : post;
    for (let i = 0; i < 5; i++) expect((await first()).status).toBe(201);
    expect((await first()).status).toBe(429);
    for (let i = 0; i < 5; i++) expect((await second()).status).toBe(201);
    expect((await second()).status).toBe(429);
    expect(mocks.update).toHaveBeenCalledTimes(5);
    expect(createItemUseCase).toHaveBeenCalledTimes(5);
});
it("H02: 同じuserのtoken・IP・対象IDを変えても5回の共通枠", async () => {
    for (let i = 0; i < 5; i++) {
        const token = makeToken(secret, 7, 7200 + i);
        const result = await request(app)
            .put("/api/items")
            .set("Authorization", "Bearer " + token)
            .set("X-Forwarded-For", `192.0.2.${10 + i}`)
            .send({ itemEditingId: 100 + i });
        expect(result.status).toBe(201);
    }
    expect((await put({ itemEditingId: 999 })).status).toBe(429);
    expect(mocks.update).toHaveBeenCalledTimes(5);
    expect((await put({ itemEditingId: 999 }, 8)).status).toBe(201);
});
it("H02 T01: usecaseが保留中はHTTP応答せず、完了後に201", async () => {
    let enter!: () => void;
    const entered = new Promise<void>((resolve) => {
        enter = resolve;
    });
    let release!: (value: number) => void;
    const gate = new Promise<number>((resolve) => {
        release = resolve;
    });
    mocks.update.mockImplementation(() => {
        enter();
        return gate;
    });
    let responded = false;
    const pending = put().then((response) => {
        responded = true;
        return response;
    });
    try {
        await Promise.race([
            entered,
            pending.then(() => {
                throw new Error("usecase開始前にHTTPが完了しました");
            }),
        ]);
        expect(responded).toBe(false);
    } finally {
        release(456);
        await pending;
    }
    const result = await pending;
    expect(result.status).toBe(201);
    expect(result.body).toEqual({ itemId: 456 });
});
