import { randomBytes } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    makeDraft,
    acceptedSpellings,
    deferred,
    invalidIds,
    waitForGate,
} from "../../../../fixtures/itemDraft/getItemDraftPage/fixtures.js";
import { makeBody } from "../../../../fixtures/itemDraft/createItemDraft/fixtures.js";

const mocks = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn() }));
vi.mock("../../../../../src/usecases/itemDraft/convertItemDraftVideo.js", () => ({
    convertItemDraftVideoUseCase: vi.fn(),
}));
vi.mock("../../../../../src/usecases/itemDraft/deleteItemDraft.js", () => ({ deleteItemDraftUseCase: vi.fn() }));
vi.mock("../../../../../src/usecases/itemDraft/getItemDraftPage.js", () => ({ getItemDraftPageUseCase: mocks.get }));
vi.mock("../../../../../src/usecases/itemDraft/createItemDraft.js", () => ({ createItemDraftUseCase: mocks.create }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
let app: ReturnType<typeof express>, secret: string;
let ErrorClass: typeof import("../../../../../src/errors.js").AppError;
const sent = vi.fn();
const token = (id = 7, admin = false) =>
    jwt.sign({ id, email: "test@example.test", admin }, secret, { expiresIn: 7200 });
const get = (id: string | number = 101, userId = 7, admin = false) =>
    request(app)
        .get(`/api/item-draft/${encodeURIComponent(String(id))}/item-page`)
        .set("Authorization", `Bearer ${token(userId, admin)}`);
beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-19T00:00:00Z"));
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.get.mockResolvedValue(makeDraft());
    mocks.create.mockResolvedValue({
        itemDraftId: 101,
        videoSignedUrl: null,
        thumbnailSignedUrl: null,
        itemImageSignedUrls: [],
        attributesImageSignedUrls: {},
    });
    const { default: router } = await import("../../../../../src/routes/itemDraft.js");
    const { errorHandler } = await import("../../../../../src/middleware/errorHandler.js");
    ({ AppError: ErrorClass } = await import("../../../../../src/errors.js"));
    app = express();
    app.use(express.json());
    app.use((_req, res, next) => {
        const json = res.json;
        res.json = (body) => {
            sent(body);
            return json.call(res, body);
        };
        next();
    });
    app.use("/api/item-draft", router);
    app.use(errorHandler);
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe("P0/P1: 実Router・認証・params・共通エラー応答", () => {
    it("R01: bodyなしで実controllerへ到達し200 JSON", async () => {
        const result = await get();
        expect(result.status).toBe(200);
        expect(result.headers["content-type"]).toContain("application/json");
        expect(result.body).toEqual({ itemDraft: JSON.parse(JSON.stringify(makeDraft())) });
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemDraftId: 101, userId: 7 });
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each(["なし", "Basic", "空Bearer", "壊れたJWT", "別鍵", "期限切れ"])(
        "R02: %sと不正idは401で停止",
        async (mode) => {
            const req = request(app).get("/api/item-draft/bad/item-page");
            if (mode === "Basic") req.set("Authorization", `Basic ${token()}`);
            if (mode === "空Bearer") req.set("Authorization", "Bearer ");
            if (mode === "壊れたJWT") req.set("Authorization", "Bearer broken");
            if (mode === "別鍵") req.set("Authorization", `Bearer ${jwt.sign({ id: 7 }, "different-test-key")}`);
            if (mode === "期限切れ")
                req.set("Authorization", `Bearer ${jwt.sign({ id: 7 }, secret, { expiresIn: -1 })}`);
            const result = await req;
            expect(result.status).toBe(401);
            expect(result.body).toEqual({
                message: ["なし", "Basic", "空Bearer"].includes(mode)
                    ? "トークンがありません。"
                    : "トークンが無効です。",
            });
            expect(mocks.get).not.toHaveBeenCalled();
        },
    );
    it.each(invalidIds.filter((x) => typeof x.value === "string" && x.value !== ""))(
        "R03: URLの$id/$valueは400でusecaseなし",
        async ({ value }) => {
            const result = await get(String(value));
            expect(result.status).toBe(400);
            expect(result.body).toEqual({ code: "INVALID_PARAMS", message: "INVALID_PARAMS" });
            expect(mocks.get).not.toHaveBeenCalled();
        },
    );
    it.each([1, 2147483647])("R01: 境界%sを数値でusecaseへ渡す", async (id) => {
        expect((await get(id)).status).toBe(200);
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemDraftId: id, userId: 7 });
    });
    it.each(["他人", "不存在"])("R05: %sを区別しない404 JSON", async () => {
        mocks.get.mockRejectedValue(new ErrorClass("ITEM_DRAFT_NOT_FOUND", 404));
        const result = await get();
        expect(result.status).toBe(404);
        expect(result.body).toEqual({ code: "ITEM_DRAFT_NOT_FOUND", message: "ITEM_DRAFT_NOT_FOUND" });
    });
    it("R05: DB例外のSQLや接続文字列・stackを公開しない", async () => {
        mocks.get.mockRejectedValue(new Error("SELECT secret FROM test; postgres://test-only-password"));
        const result = await get();
        expect(result.status).toBe(500);
        expect(result.body).toEqual({ error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
    });
    it.each(["欠落", "余分なパス", "PUT", "PATCH"])("R07: 定義外%sで取得しない", async (mode) => {
        const req =
            mode === "PUT"
                ? request(app).put("/api/item-draft/101/item-page")
                : mode === "PATCH"
                  ? request(app).patch("/api/item-draft/101/item-page")
                  : request(app).get(`/api/item-draft${mode === "欠落" ? "" : "/101/extra"}`);
        expect((await req.set("Authorization", `Bearer ${token()}`)).status).toBe(404);
        expect(mocks.get).not.toHaveBeenCalled();
    });
    it("R01: body/queryの他人ID・所有者を採用しない", async () => {
        expect(
            (await get().query({ id: 202, userId: 8, seller_id: 8 }).send({ id: 303, userId: 8, seller_id: 8 }))
                .status,
        ).toBe(200);
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemDraftId: 101, userId: 7 });
    });
    it("R08: usecaseの保留中にJSONを送信しない", async () => {
        const gate = deferred<ReturnType<typeof makeDraft>>(),
            entered = deferred<void>();
        mocks.get.mockImplementation(() => {
            entered.resolve();
            return gate.promise;
        });
        const pending = get().then((x) => x);
        try {
            await waitForGate(entered.promise, pending);
            expect(sent).not.toHaveBeenCalled();
        } finally {
            gate.resolve(makeDraft());
            await pending;
        }
        expect(sent).toHaveBeenCalledExactlyOnceWith({ itemDraft: makeDraft() });
    });
    it("R01: 管理者も認証本人のIDを渡す", async () => {
        expect((await get(101, 8, true)).status).toBe(200);
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemDraftId: 101, userId: 8 });
    });
    it.each(acceptedSpellings)("R04: URL表記%sは%sへ数値化", async (id, expected) => {
        expect((await get(id)).status).toBe(200);
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemDraftId: expected, userId: 7 });
    });
    it.each(["正常", "なし", "不正"])("R06: 不正JSONは認証より前に400（JWT=%s）", async (auth) => {
        const req = request(app).get("/api/item-draft/101/item-page").set("Content-Type", "application/json");
        if (auth === "正常") req.set("Authorization", `Bearer ${token()}`);
        if (auth === "不正") req.set("Authorization", "Bearer invalid-jwt");
        const result = await req.send('{"broken":');
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ code: "INVALID_JSON", message: "JSONの形式を確認してください。" });
        expect(mocks.get).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });
});

describe("P0/P1/P2: 実MemoryStoreのユーザー別レート制限", () => {
    const exhaust = async () => {
        for (let i = 0; i < 50; i++) expect((await get(i + 1)).status).toBe(200);
    };
    it("L01: 50回まで許可、51/52回目を429、standardヘッダー", async () => {
        for (let i = 1; i <= 50; i++) {
            const result = await get(i);
            expect(result.status).toBe(200);
            if ([1, 49, 50].includes(i)) expect(result.headers["ratelimit-remaining"]).toBe(String(50 - i));
        }
        for (let i = 0; i < 2; i++) {
            const result = await get();
            expect(result.status).toBe(429);
            expect(result.text).toBe("Too many requests, please try again later.");
            expect(result.headers["ratelimit-limit"]).toBe("50");
            expect(result.headers["ratelimit-remaining"]).toBe("0");
            expect(result.headers["retry-after"]).toBe("60");
            expect(result.headers["x-ratelimit-limit"]).toBeUndefined();
            expect(result.headers["x-ratelimit-remaining"]).toBeUndefined();
            expect(result.headers["x-ratelimit-reset"]).toBeUndefined();
        }
        expect(mocks.get).toHaveBeenCalledTimes(50);
    });
    it.each([400, 404, 500])("L02: %sも50回分消費する", async (status) => {
        if (status !== 400)
            mocks.get.mockRejectedValue(
                status === 404 ? new ErrorClass("ITEM_DRAFT_NOT_FOUND", 404) : new Error("db"),
            );
        for (let i = 0; i < 50; i++) expect((await get(status === 400 ? `bad${i}` : i + 1)).status).toBe(status);
        expect((await get()).status).toBe(429);
        expect(mocks.get).toHaveBeenCalledTimes(status === 400 ? 0 : 50);
    });
    it("L03: 同じIPでも別ユーザーの枠は独立", async () => {
        await exhaust();
        expect((await get(101, 8)).status).toBe(200);
        expect((await get()).status).toBe(429);
    });
    it("L03: JWT再発行・ID/query/IP変更では同じユーザー枠を回避できない", async () => {
        for (let i = 0; i < 51; i++) {
            const fresh = jwt.sign({ id: 7, jti: `token-${i}` }, secret, { expiresIn: 7200 });
            const result = await get(i + 1)
                .set("Authorization", `Bearer ${fresh}`)
                .set("X-Real-IP", `192.0.2.${i + 1}`)
                .query({ userId: i + 100 });
            expect(result.status).toBe(i < 50 ? 200 : 429);
        }
    });
    it("L03 L04: 無認証は枠消費なし、制限超過は入力不正より優先", async () => {
        for (let i = 0; i < 51; i++) expect((await request(app).get("/api/item-draft/bad/item-page")).status).toBe(401);
        await exhaust();
        expect((await get("bad")).status).toBe(429);
        expect((await request(app).get("/api/item-draft/bad/item-page")).status).toBe(401);
        expect(mocks.get).toHaveBeenCalledTimes(50);
    });
    it("L04: resetの直前・到達・直後の境界", async () => {
        await exhaust();
        await vi.advanceTimersByTimeAsync(59999);
        expect((await get()).status).toBe(429);
        await vi.advanceTimersByTimeAsync(1);
        const atReset = await get();
        expect(atReset.status).toBe(200);
        expect(atReset.headers["ratelimit-remaining"]).toBe("49");
        await vi.advanceTimersByTimeAsync(1);
        expect((await get()).headers["ratelimit-remaining"]).toBe("48");
    });
    it.each(["取得先行", "作成先行"])("L05: %sでも作成と取得のstoreは独立", async (order) => {
        const create = () =>
            request(app).post("/api/item-draft").set("Authorization", `Bearer ${token()}`).send(makeBody());
        if (order === "取得先行") {
            await exhaust();
            expect((await create()).status).toBe(200);
        } else {
            for (let i = 0; i < 5; i++) expect((await create()).status).toBe(200);
            expect((await create()).status).toBe(429);
            expect((await get()).status).toBe(200);
        }
    });
    it("L05: 51要求同時でも50通過と1拒否", async () => {
        const results = await Promise.all(Array.from({ length: 51 }, (_, i) => get(i + 1).then((x) => x.status)));
        expect(results.filter((x) => x === 200)).toHaveLength(50);
        expect(results.filter((x) => x === 429)).toHaveLength(1);
        expect(mocks.get).toHaveBeenCalledTimes(50);
    });
});
