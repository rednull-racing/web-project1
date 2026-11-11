import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
import "../../../../fixtures/watchHistory/getWatchItemList/httpMocks.js";
import { deleteWatchHistoryUseCase } from "../../../../../src/usecases/watchHistory/delete.js";
vi.mock("../../../../../src/usecases/watchHistory/getWatchItemList.js", () => ({
    getWatchItemListUseCase: mocks.list,
}));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((ok, fail) => {
        resolve = ok;
        reject = fail;
    });
    return { promise, resolve, reject };
};
let app: express.Express;
let secret: string;
const token = (id = 7) => jwt.sign({ id, email: "test@example.invalid", admin: false }, secret, { expiresIn: 3600 });
const get = (query = "", id = 7) =>
    request(app)
        .get("/api/watch-history/item-list" + query)
        .set("Authorization", "Bearer " + token(id));
beforeEach(async () => {
    vi.resetModules();
    mocks.list.mockReset();
    mocks.list.mockResolvedValue({ itemList: [], totalPages: 0 });
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-11-10T00:00:00Z"));
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { default: router } = await import("../../../../../src/routes/watchHistory.js");
    const { errorHandler } = await import("../../../../../src/middleware/errorHandler.js");
    app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.use("/api/watch-history", router);
    app.use(errorHandler);
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});
describe("P0 HTTP契約・実認証/制限/検証/controller", () => {
    it("H01: 認証ID・検証済みqueryのみ採用し200", async () => {
        const response = await get("?page=2&keyword=%20シャツ%20&seller_id=99&userId=99");
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ itemList: [], totalPages: 0 });
        expect(mocks.list).toHaveBeenCalledExactlyOnceWith({
            userId: 7,
            page: 2,
            status: undefined,
            keyword: "シャツ",
        });
    });
    it.each(["?page=0", "?page=10001", "?keyword=a&keyword=b", "?page=1&page=2"])(
        "H02: %sは400、業務処理未実行",
        async (query) => {
            const response = await get(query);
            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: "INVALID_QUERY", message: "INVALID_QUERY" });
            expect(mocks.list).not.toHaveBeenCalled();
        },
    );
    it.each(["missing", "invalid", "expired"])("H03: %s認証は401・業務未実行", async (kind) => {
        let req = request(app).get("/api/watch-history/item-list?page=0");
        if (kind !== "missing")
            req = req.set(
                "Authorization",
                "Bearer " + (kind === "invalid" ? "invalid" : jwt.sign({ id: 7 }, secret, { expiresIn: -1 })),
            );
        const response = await req;
        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            message: kind === "missing" ? "トークンがありません。" : "トークンが無効です。",
        });
        expect(mocks.list).not.toHaveBeenCalled();
    });
    it("H04: 内部エラー情報を公開しない", async () => {
        mocks.list.mockRejectedValue(new Error("private-marker"));
        const response = await get();
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
    });
    it("H05: 50回・51回・別本人・窓再開・超過優先", async () => {
        for (let i = 0; i < 50; i++) expect((await get()).status).toBe(200);
        const blocked = await get("?page=0");
        expect(blocked.status).toBe(429);
        expect(blocked.headers["retry-after"]).toBeDefined();
        expect(blocked.headers["ratelimit-limit"]).toBe("50");
        expect(mocks.list).toHaveBeenCalledTimes(50);
        expect((await get("", 8)).status).toBe(200);
        vi.setSystemTime(new Date("2026-11-10T00:01:00Z"));
        expect((await get()).status).toBe(200);
    });
    it("H06: 400/500も計上し未認証・不正JSONは非計上", async () => {
        for (let i = 0; i < 51; i++) {
            expect((await request(app).get("/api/watch-history/item-list")).status).toBe(401);
            const malformed = await request(app)
                .get("/api/watch-history/item-list")
                .set("Authorization", "Bearer " + token())
                .set("Content-Type", "application/json")
                .send("{");
            expect(malformed.status).toBe(400);
            expect(malformed.body).toEqual({ code: "INVALID_JSON", message: "JSONの形式を確認してください。" });
        }
        for (let i = 0; i < 25; i++) expect((await get("?page=0")).status).toBe(400);
        mocks.list.mockRejectedValue(new Error("failure"));
        for (let i = 0; i < 25; i++) expect((await get()).status).toBe(500);
        expect((await get()).status).toBe(429);
        expect(mocks.list).toHaveBeenCalledTimes(25);
    });
});

describe("P0 query・公開JSON・完了待機", () => {
    it.each([
        ["", 1, undefined, null],
        ["?page=1&status=active", 1, "active", null],
        ["?page=10000&status=soldout", 10000, "soldout", null],
        ["?status=hidden&keyword=null", 1, undefined, null],
        ["?status=active&status=soldout", 1, undefined, null],
        ["?status[x]=active", 1, undefined, null],
        ["?status=&keyword=%20%20", 1, undefined, null],
    ])("H07: %sを正規化した検証値だけ渡す", async (query, page, status, keyword) => {
        expect((await get(query)).status).toBe(200);
        expect(mocks.list).toHaveBeenCalledExactlyOnceWith({ userId: 7, page, status, keyword });
    });
    it.each(["?page=", "?page=1.5", "?page=-1", "?page[x]=1", "?keyword[x]=a"])(
        "H02: %sを拒否してusecase未実行",
        async (query) => {
            const response = await get(query);
            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: "INVALID_QUERY", message: "INVALID_QUERY" });
            expect(mocks.list).not.toHaveBeenCalled();
        },
    );
    it("H08: JSON例の全項目・欠落関連nullを返す", async () => {
        const row = {
            id: 123,
            name: "商品名",
            price: 1000,
            status: "active",
            first_image_url: null,
            gender_type: "unisex",
            age_type: "both",
            Video: { title: null },
            Sale: { before_price: 2000, sale_flag: true, discount_rate: 0, discount_amount: 1000 },
        };
        mocks.list.mockResolvedValue({
            itemList: [{ item: row }, { item: { ...row, id: 124, Video: null, Sale: null } }],
            totalPages: 7,
        });
        const response = await get();
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            itemList: [{ item: { ...row } }, { item: { ...row, id: 124, Video: null, Sale: null } }],
            totalPages: 7,
        });
    });
    it.each(["success", "failure"])("H10: usecase保留中は応答せず%s確定後に返す", async (mode) => {
        const started = deferred<void>();
        const gate = deferred<{ itemList: never[]; totalPages: number }>();
        mocks.list.mockImplementation(() => {
            started.resolve(undefined);
            return gate.promise;
        });
        let completed = false;
        const pending = get().then((response) => {
            completed = true;
            return response;
        });
        try {
            await Promise.race([
                started.promise,
                pending.then(() => {
                    throw new Error("usecase到達前にHTTPが終了");
                }),
            ]);
            expect(completed).toBe(false);
            if (mode === "failure") gate.reject(new Error("private failure marker"));
            else gate.resolve({ itemList: [], totalPages: 0 });
            const response = await pending;
            expect(response.status).toBe(mode === "failure" ? 500 : 200);
            expect(response.body).toEqual(
                mode === "failure"
                    ? { error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" }
                    : { itemList: [], totalPages: 0 },
            );
            expect(mocks.list).toHaveBeenCalledTimes(1);
        } finally {
            gate.resolve({ itemList: [], totalPages: 0 });
            await pending;
        }
    });
    it.each([59999, 60000, 60001])("H11: 窓の%s msで受付を判定", async (elapsed) => {
        for (let i = 0; i < 50; i++) expect((await get()).status).toBe(200);
        await vi.advanceTimersByTimeAsync(elapsed);
        expect((await get()).status).toBe(elapsed < 60000 ? 429 : 200);
    });
    it("H12: 同一本人はトークン・IP・偽装queryを変えても枠を共有", async () => {
        for (let i = 0; i < 50; i++) expect((await get()).status).toBe(200);
        const response = await request(app)
            .get("/api/watch-history/item-list?userId=8&seller_id=8")
            .set("Authorization", "Bearer " + jwt.sign({ id: 7, jti: "another-token" }, secret))
            .set("X-Forwarded-For", "192.0.2.10");
        expect(response.status).toBe(429);
        expect(response.text).toBe("Too many requests, please try again later.");
        expect(Object.keys(response.headers).some((key) => key.startsWith("x-ratelimit"))).toBe(false);
        expect(mocks.list).toHaveBeenCalledTimes(50);
    });

    it("H13: 一覧の枠を使い切っても既存の履歴削除が使える", async () => {
        for (let i = 0; i < 50; i++) expect((await get()).status).toBe(200);
        expect((await get()).status).toBe(429);
        const response = await request(app)
            .delete("/api/watch-history/123")
            .set("Authorization", "Bearer " + token());
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: "閲覧履歴を削除しました" });
        expect(deleteWatchHistoryUseCase).toHaveBeenCalledExactlyOnceWith({ itemId: 123, userId: 7 });
    });
});
