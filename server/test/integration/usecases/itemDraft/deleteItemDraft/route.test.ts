import { randomBytes } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    acceptedSpellings,
    deferred,
    invalidIds,
    waitForGate,
} from "../../../../fixtures/itemDraft/deleteItemDraft/fixtures.js";
import { makeBody } from "../../../../fixtures/itemDraft/createItemDraft/fixtures.js";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), create: vi.fn() }));
vi.mock("../../../../../src/usecases/itemDraft/convertItemDraftVideo.js", () => ({
    convertItemDraftVideoUseCase: vi.fn(),
}));
vi.mock("../../../../../src/usecases/itemDraft/deleteItemDraft.js", () => ({ deleteItemDraftUseCase: mocks.remove }));
vi.mock("../../../../../src/usecases/itemDraft/createItemDraft.js", () => ({ createItemDraftUseCase: mocks.create }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
let app: ReturnType<typeof express>, secret: string;
let ErrorClass: typeof import("../../../../../src/errors.js").AppError;
const sent = vi.fn();
const token = (id = 7, admin = false) =>
    jwt.sign({ id, email: "test@example.test", admin }, secret, { expiresIn: 7200 });
const remove = (id: string | number = 101, userId = 7, admin = false) =>
    request(app)
        .delete(`/api/item-draft/${encodeURIComponent(String(id))}`)
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
    mocks.remove.mockResolvedValue(undefined);
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
        const result = await remove();
        expect(result.status).toBe(200);
        expect(result.headers["content-type"]).toContain("application/json");
        expect(result.body).toEqual({ message: "下書き商品を削除しました" });
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ itemDraftId: 101, userId: 7 });
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it.each(["なし", "Basic", "空Bearer", "壊れたJWT", "別鍵", "期限切れ"])(
        "R02 R09: %sと不正idは401で停止",
        async (mode) => {
            const req = request(app).delete("/api/item-draft/bad");
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
            expect(mocks.remove).not.toHaveBeenCalled();
        },
    );
    it.each(invalidIds.filter((x) => typeof x.value === "string" && x.value !== ""))(
        "R03: URLの$id/$valueは400でusecaseなし",
        async ({ value }) => {
            const result = await remove(String(value));
            expect(result.status).toBe(400);
            expect(result.body).toEqual({ code: "INVALID_PARAMS", message: "INVALID_PARAMS" });
            expect(mocks.remove).not.toHaveBeenCalled();
        },
    );
    it.each([1, 2147483647])("R04: 境界%sを数値でusecaseへ渡す", async (id) => {
        expect((await remove(id)).status).toBe(200);
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ itemDraftId: id, userId: 7 });
    });
    it.each(["他人", "不存在"])("R05: %sを区別しない404 JSON", async () => {
        mocks.remove.mockRejectedValue(new ErrorClass("ITEM_DRAFT_NOT_FOUND", 404));
        const result = await remove();
        expect(result.status).toBe(404);
        expect(result.body).toEqual({ code: "ITEM_DRAFT_NOT_FOUND", message: "ITEM_DRAFT_NOT_FOUND" });
    });
    it("R06: DB例外のSQLや接続文字列・stackを公開しない", async () => {
        mocks.remove.mockRejectedValue(new Error("SELECT secret FROM test; postgres://test-only-password"));
        const result = await remove();
        expect(result.status).toBe(500);
        expect(result.body).toEqual({ error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
    });
    it.each(["欠落", "余分なパス", "PUT", "PATCH"])("R07: 定義外%sで削除しない", async (mode) => {
        const req =
            mode === "PUT"
                ? request(app).put("/api/item-draft/101")
                : mode === "PATCH"
                  ? request(app).patch("/api/item-draft/101")
                  : request(app).delete(`/api/item-draft${mode === "欠落" ? "" : "/101/extra"}`);
        expect((await req.set("Authorization", `Bearer ${token()}`)).status).toBe(404);
        expect(mocks.remove).not.toHaveBeenCalled();
    });
    it("R08: body/queryの他人ID・所有者を採用しない", async () => {
        expect(
            (await remove().query({ id: 202, userId: 8, seller_id: 8 }).send({ id: 303, userId: 8, seller_id: 8 }))
                .status,
        ).toBe(200);
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ itemDraftId: 101, userId: 7 });
    });
    it("R11: usecaseの保留中にJSONを送信しない", async () => {
        const gate = deferred<void>(),
            entered = deferred<void>();
        mocks.remove.mockImplementation(() => {
            entered.resolve();
            return gate.promise;
        });
        const pending = remove().then((x) => x);
        try {
            await waitForGate(entered.promise, pending);
            expect(sent).not.toHaveBeenCalled();
        } finally {
            gate.resolve();
            await pending;
        }
        expect(sent).toHaveBeenCalledExactlyOnceWith({ message: "下書き商品を削除しました" });
    });
    it("R12: 管理者も認証本人のIDを渡す", async () => {
        expect((await remove(101, 8, true)).status).toBe(200);
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ itemDraftId: 101, userId: 8 });
    });
    it.each(acceptedSpellings)("O01: URL表記%sは%sへ数値化", async (id, expected) => {
        expect((await remove(id)).status).toBe(200);
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({ itemDraftId: expected, userId: 7 });
    });
    it.each(["正常", "なし", "不正"])("AF-JSON01 O03: 不正JSONは認証より前に400（JWT=%s）", async (auth) => {
        const req = request(app).delete("/api/item-draft/101").set("Content-Type", "application/json");
        if (auth === "正常") req.set("Authorization", `Bearer ${token()}`);
        if (auth === "不正") req.set("Authorization", "Bearer invalid-jwt");
        const result = await req.send('{"broken":');
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ code: "INVALID_JSON", message: "JSONの形式を確認してください。" });
        expect(mocks.remove).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });
});

describe("P0/P1/P2: 実MemoryStoreのユーザー別レート制限", () => {
    const exhaust = async () => {
        for (let i = 0; i < 20; i++) expect((await remove(i + 1)).status).toBe(200);
    };
    it("L01 L09: 20回まで許可、21/22回目を429、standardヘッダー", async () => {
        for (let i = 1; i <= 20; i++) {
            const result = await remove(i);
            expect(result.status).toBe(200);
            if ([1, 19, 20].includes(i)) expect(result.headers["ratelimit-remaining"]).toBe(String(20 - i));
        }
        for (let i = 0; i < 2; i++) {
            const result = await remove();
            expect(result.status).toBe(429);
            expect(result.text).toBe("Too many requests, please try again later.");
            expect(result.headers["ratelimit-limit"]).toBe("20");
            expect(result.headers["ratelimit-remaining"]).toBe("0");
            expect(result.headers["retry-after"]).toBe("300");
            expect(result.headers["x-ratelimit-limit"]).toBeUndefined();
            expect(result.headers["x-ratelimit-remaining"]).toBeUndefined();
            expect(result.headers["x-ratelimit-reset"]).toBeUndefined();
        }
        expect(mocks.remove).toHaveBeenCalledTimes(20);
    });
    it.each([400, 404, 500])("L02 L03 L04: %sも20回分消費する", async (status) => {
        if (status !== 400)
            mocks.remove.mockRejectedValue(
                status === 404 ? new ErrorClass("ITEM_DRAFT_NOT_FOUND", 404) : new Error("db"),
            );
        for (let i = 0; i < 20; i++) expect((await remove(status === 400 ? `bad${i}` : i + 1)).status).toBe(status);
        expect((await remove()).status).toBe(429);
        expect(mocks.remove).toHaveBeenCalledTimes(status === 400 ? 0 : 20);
    });
    it("L05: 同じIPでも別ユーザーの枠は独立", async () => {
        await exhaust();
        expect((await remove(101, 8)).status).toBe(200);
        expect((await remove()).status).toBe(429);
    });
    it("L06: JWT再発行・ID/query/IP変更では同じユーザー枠を回避できない", async () => {
        for (let i = 0; i < 21; i++) {
            const fresh = jwt.sign({ id: 7, jti: `token-${i}` }, secret, { expiresIn: 7200 });
            const result = await remove(i + 1)
                .set("Authorization", `Bearer ${fresh}`)
                .set("X-Real-IP", `192.0.2.${i + 1}`)
                .query({ userId: i + 100 });
            expect(result.status).toBe(i < 20 ? 200 : 429);
        }
    });
    it("L07 R09 R10: 無認証は枠消費なし、制限超過は入力不正より優先", async () => {
        for (let i = 0; i < 21; i++) expect((await request(app).delete("/api/item-draft/bad")).status).toBe(401);
        await exhaust();
        expect((await remove("bad")).status).toBe(429);
        expect((await request(app).delete("/api/item-draft/bad")).status).toBe(401);
        expect(mocks.remove).toHaveBeenCalledTimes(20);
    });
    it("L08: resetの直前・到達・直後の境界", async () => {
        await exhaust();
        await vi.advanceTimersByTimeAsync(299999);
        expect((await remove()).status).toBe(429);
        await vi.advanceTimersByTimeAsync(1);
        const atReset = await remove();
        expect(atReset.status).toBe(200);
        expect(atReset.headers["ratelimit-remaining"]).toBe("19");
        await vi.advanceTimersByTimeAsync(1);
        expect((await remove()).headers["ratelimit-remaining"]).toBe("18");
    });
    it.each(["削除先行", "作成先行"])("L10: %sでも作成と削除のstoreは独立", async (order) => {
        const create = () =>
            request(app).post("/api/item-draft").set("Authorization", `Bearer ${token()}`).send(makeBody());
        if (order === "削除先行") {
            await exhaust();
            expect((await create()).status).toBe(200);
        } else {
            for (let i = 0; i < 5; i++) expect((await create()).status).toBe(200);
            expect((await create()).status).toBe(429);
            expect((await remove()).status).toBe(200);
        }
    });
    it("L11: 21要求同時でも20通過と1拒否", async () => {
        const results = await Promise.all(Array.from({ length: 21 }, (_, i) => remove(i + 1).then((x) => x.status)));
        expect(results.filter((x) => x === 200)).toHaveLength(20);
        expect(results.filter((x) => x === 429)).toHaveLength(1);
        expect(mocks.remove).toHaveBeenCalledTimes(20);
    });
});
