import { randomBytes } from "node:crypto";
import type { Application } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { videoHttpMocks as mocks } from "../../../../fixtures/itemEditing/convertedItemEditingVideo/httpMocks.js";
import { deferred, makeVideoHttpApp, makeVideoToken, patchVideo } from "../../../../fixtures/itemEditing/convertedItemEditingVideo/httpFixtures.js";

// 実appのparser順を検証するケースだけが使う。cron・対象外Routerの起動を遮断する。
vi.mock("../../../../../src/cron/index.js", () => ({ startAllCrons: vi.fn() }));
vi.mock("../../../../../src/routes/index.js", async () => {
    const { default: router } = await import("../../../../../src/routes/itemEditing.js");
    return { registerRoutes: (app: Application) => app.use("/api/item-editing", router) };
});

let app: Awaited<ReturnType<typeof makeVideoHttpApp>>, secret: string;
const patch = (id: number | string = 101, userId = 7) => patchVideo(app, secret, id, userId);
const accepted = { message: "変換処理を受け付けました" };
const limited = "Too many requests, please try again later.";
const consume = async () => {
    for (let i = 0; i < 5; i++) expect((await patch()).body).toEqual(accepted);
};

beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-22T00:00:00Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    mocks.convert.mockResolvedValue(undefined);
    mocks.create.mockResolvedValue(456);
    app = await makeVideoHttpApp();
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe("P0 実Router・認証・params・202境界", () => {
    it("H01: body/queryの所有者やIDを無視して認証ID・paramsだけを渡す", async () => {
        const result = await patch().query({ userId: 8, id: 999 }).send({ userId: 8, seller_id: 8, itemEditingId: 888 });
        expect(result.status).toBe(202);
        expect(result.body).toEqual(accepted);
        expect(mocks.convert).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: 101 });
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each(["なし", "Bearer空", "不正署名", "期限切れ"])("H02: %sは202と認証拒否本文で変換を開始しない", async (mode) => {
        const req = request(app).patch("/api/item-editing/not-number/convert");
        if (mode === "Bearer空") req.set("Authorization", "Bearer ");
        if (mode === "不正署名") req.set("Authorization", "Bearer " + makeVideoToken("different-secret"));
        if (mode === "期限切れ") req.set("Authorization", "Bearer " + makeVideoToken(secret, 7, -1));
        const result = await req;
        expect(result.status).toBe(202);
        expect(result.body).toEqual({ message: ["なし", "Bearer空"].includes(mode) ? "トークンがありません。" : "トークンが無効です。" });
        expect(mocks.convert).not.toHaveBeenCalled();
    });
    it.each([1, 2, 2147483646, 2147483647])("H03: id=%sは整数として受け付ける", async (id) => {
        const result = await patch(id);
        expect(result.status).toBe(202);
        expect(result.body).toEqual(accepted);
        expect(mocks.convert).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemEditingId: id });
    });
    it.each([0, -1, 1.5, 2147483648, "invalid", "NaN", "Infinity"])("H03: id=%sは202と入力拒否本文で停止する", async (id) => {
        const result = await patch(id);
        expect(result.status).toBe(202);
        expect(result.body).toEqual({ code: "INVALID_PARAMS", message: "INVALID_PARAMS" });
        expect(mocks.convert).not.toHaveBeenCalled();
        expect(result.headers["ratelimit-remaining"]).toBe("4");
    });
    it.each(['{"secret":"do-not-publish",', '"primitive"'])("H04: JSON=%sのparser拒否は未認証より先に202で返す", async (raw) => {
        const result = await request(app).patch("/api/item-editing/101/convert").set("Content-Type", "application/json").send(raw);
        expect(result.status).toBe(202);
        expect(result.body).toEqual({ code: "INVALID_JSON", message: "JSONの形式を確認してください。" });
        expect(result.text).not.toContain("do-not-publish");
        expect(result.headers["ratelimit-remaining"]).toBeUndefined();
        expect(mocks.convert).not.toHaveBeenCalled();
    });
    it("H01 C02: usecase保留中でもHTTP受付を完了する", async () => {
        const gate = deferred<void>(), started = deferred<void>();
        mocks.convert.mockImplementation(() => { started.resolve(); return gate.promise; });
        try {
            const result = await patch();
            await started.promise;
            expect(result.status).toBe(202);
            expect(result.body).toEqual(accepted);
        } finally { gate.resolve(); await gate.promise; }
    });
    it.each([404, 400, 422, 408, 409, 500])("H12: 内部%sでも受付本文を維持し詳細を公開しない", async (status) => {
        const { AppError } = await import("../../../../../src/errors.js");
        const error = status === 500 ? new Error("private-detail") : new AppError("PRIVATE_DETAIL", status);
        const caught = deferred<void>();
        const log = vi.mocked(console.error).mockImplementation(() => caught.resolve());
        mocks.convert.mockRejectedValue(error);
        const result = await patch();
        await caught.promise;
        expect(result.status).toBe(202);
        expect(result.body).toEqual(accepted);
        expect(log).toHaveBeenCalledExactlyOnceWith("Detached task failed", {
            taskName: "convertedItemEditingVideo", target: { userId: 7, itemEditingId: 101 }, error,
        });
        if (error instanceof AppError) expect(error.statusCode).toBe(status);
    });
});

describe("P0/P1 専用レート制限と優先順位", () => {
    it("H05: 5回許可・6回目は202と従来limiter本文/headersで停止する", async () => {
        await consume();
        const result = await patch();
        expect(result.status).toBe(202);
        expect(result.text).toBe(limited);
        expect(result.headers["retry-after"]).toBe("600");
        expect(result.headers["ratelimit-limit"]).toBe("5");
        expect(result.headers["ratelimit-remaining"]).toBe("0");
        expect(Object.keys(result.headers).some((key) => key.startsWith("x-ratelimit"))).toBe(false);
        expect(mocks.convert).toHaveBeenCalledTimes(5);
    });
    it("H06: 同一ユーザーはID/IP/tokenを変えても同枠、別ユーザーと別APIは独立する", async () => {
        await consume();
        const sameUser = await patch(202).set("X-Forwarded-For", "192.0.2.12")
            .set("Authorization", "Bearer " + makeVideoToken(secret, 7, 7300));
        expect(sameUser.text).toBe(limited);
        expect((await patch(101, 8)).body).toEqual(accepted);
        const anotherApi = await request(app).post("/api/item-editing").set("Authorization", "Bearer " + makeVideoToken(secret));
        expect(anotherApi.status).toBe(200);
        expect(anotherApi.body).toEqual({ itemEditingId: 456 });
        expect(mocks.convert).toHaveBeenCalledTimes(6);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7 });
    });
    it.each([599999, 600000, 600001])("H07: 窓開始から%s msで制限と再開を判定する", async (elapsed) => {
        await consume();
        await vi.advanceTimersByTimeAsync(elapsed);
        const result = await patch();
        expect(result.status).toBe(202);
        if (elapsed < 600000) expect(result.text).toBe(limited);
        else expect(result.body).toEqual(accepted);
        expect(mocks.convert).toHaveBeenCalledTimes(elapsed < 600000 ? 5 : 6);
    });
    it.each(["params", "業務失敗"])("H08: %sも枠を消費し6回目の変換を開始しない", async (kind) => {
        if (kind === "業務失敗") mocks.convert.mockRejectedValue(new Error("conversion failed"));
        for (let i = 0; i < 5; i++) {
            const result = await patch(kind === "params" ? 0 : 101);
            expect(result.status).toBe(202);
            expect(result.body).toEqual(kind === "params" ? { code: "INVALID_PARAMS", message: "INVALID_PARAMS" } : accepted);
        }
        expect((await patch(0)).text).toBe(limited);
        expect(mocks.convert).toHaveBeenCalledTimes(kind === "params" ? 0 : 5);
    });
    it.each(["未認証", "parser拒否"])("H09: %sはユーザー枠を消費しない", async (kind) => {
        for (let i = 0; i < 6; i++) {
            const req = request(app).patch("/api/item-editing/101/convert");
            if (kind === "parser拒否") req.set("Authorization", "Bearer " + makeVideoToken(secret)).set("Content-Type", "application/json").send("{");
            const result = await req;
            expect(result.status).toBe(202);
            expect(result.body).toEqual(kind === "未認証" ? { message: "トークンがありません。" } : { code: "INVALID_JSON", message: "JSONの形式を確認してください。" });
        }
        await consume();
        expect((await patch()).text).toBe(limited);
        expect(mocks.convert).toHaveBeenCalledTimes(5);
    });
    it("H09: 制限超過よりparser、paramsより認証・limiterを優先する", async () => {
        await consume();
        expect((await patch(0)).text).toBe(limited);
        expect((await request(app).patch("/api/item-editing/0/convert")).body).toEqual({ message: "トークンがありません。" });
        const malformed = await patch(0).set("Content-Type", "application/json").send("{");
        expect(malformed.body).toEqual({ code: "INVALID_JSON", message: "JSONの形式を確認してください。" });
        expect(mocks.convert).toHaveBeenCalledTimes(5);
    });
});

describe("P1 app接続と対象パス境界", () => {
    it.each(["/api/item-editing/101/convert/", "/API/ITEM-EDITING/101/CONVERT"])("H10: Expressが受ける%sも202境界を適用する", async (path) => {
        const result = await request(app).patch(path);
        expect(result.status).toBe(202);
        expect(result.body).toEqual({ message: "トークンがありません。" });
        expect(mocks.convert).not.toHaveBeenCalled();
    });
    it.each(["POST", "PUT"])("H10: 対象外%sのJSON拒否は従来400を維持する", async (method) => {
        const req = method === "POST" ? request(app).post("/api/item-editing") : request(app).put("/api/item-editing/101");
        const result = await req.set("Content-Type", "application/json").send("{");
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ code: "INVALID_JSON", message: "JSONの形式を確認してください。" });
        expect(mocks.convert).not.toHaveBeenCalled();
    });
    it("H10: 同一PATCHの別URLは従来404を維持する", async () => {
        const result = await request(app).patch("/api/item-editing/101/convert/other");
        expect(result.status).toBe(404);
        expect(mocks.convert).not.toHaveBeenCalled();
    });
    it("H11: 実app.tsでも202境界がparserより前にあり他APIの400を維持する", async () => {
        const { default: actualApp } = await import("../../../../../src/app.js");
        const result = await request(actualApp).patch("/api/item-editing/101/convert").set("Content-Type", "application/json").send("{");
        expect(result.status).toBe(202);
        expect(result.body).toEqual({ code: "INVALID_JSON", message: "JSONの形式を確認してください。" });
        const other = await request(actualApp).post("/api/item-editing").set("Content-Type", "application/json").send("{");
        expect(other.status).toBe(400);
        expect(mocks.convert).not.toHaveBeenCalled();
    });
});
