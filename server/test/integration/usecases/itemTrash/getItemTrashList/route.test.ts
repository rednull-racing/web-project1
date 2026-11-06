import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../../../../../src/usecases/itemTrash/getItemTrashList.js", () => ({ getItemTrashListUseCase: mocks.list }));
vi.mock("../../../../../src/usecases/itemTrash/createItemTrash.js", () => ({ createItemTrashUseCase: vi.fn() }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
let app: express.Express;
let secret: string;
const token = (id = 7) => jwt.sign({ id, email: "test@example.invalid", admin: false }, secret, { expiresIn: 3600 });
const get = (query = "", id = 7) =>
    request(app)
        .get("/api/item-trash/list" + query)
        .set("Authorization", "Bearer " + token(id));
beforeEach(async () => {
    vi.resetModules();
    mocks.list.mockReset();
    mocks.list.mockResolvedValue({ itemTrashList: [], totalPages: 0 });
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-11-06T00:00:00Z"));
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { default: router } = await import("../../../../../src/routes/itemTrash.js");
    const { errorHandler } = await import("../../../../../src/middleware/errorHandler.js");
    app = express();
    app.use(express.json());
    app.use("/api/item-trash", router);
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
        expect(response.body).toEqual({ itemTrashList: [], totalPages: 0 });
        expect(mocks.list).toHaveBeenCalledExactlyOnceWith({ userId: 7, page: 2, keyword: "シャツ" });
    });
    it.each(["?page=0", "?page=10001", "?keyword=a&keyword=b", "?page=1&page=2"])(
        "H01: %sは400、業務処理未実行",
        async (query) => {
            const response = await get(query);
            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: "INVALID_QUERY", message: "INVALID_QUERY" });
            expect(mocks.list).not.toHaveBeenCalled();
        },
    );
    it.each(["missing", "invalid", "expired"])("H01: %s認証は401・業務未実行", async (kind) => {
        let req = request(app).get("/api/item-trash/list?page=0");
        if (kind !== "missing")
            req = req.set(
                "Authorization",
                "Bearer " + (kind === "invalid" ? "invalid" : jwt.sign({ id: 7 }, secret, { expiresIn: -1 })),
            );
        const response = await req;
        expect(response.status).toBe(401);
        expect(mocks.list).not.toHaveBeenCalled();
    });
    it("H01: 内部エラー情報を公開しない", async () => {
        mocks.list.mockRejectedValue(new Error("private-marker"));
        const response = await get();
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
    });
    it("H02: 50回・51回・別本人・窓再開・超過優先", async () => {
        for (let i = 0; i < 50; i++) expect((await get()).status).toBe(200);
        const blocked = await get("?page=0");
        expect(blocked.status).toBe(429);
        expect(blocked.headers["retry-after"]).toBeDefined();
        expect(blocked.headers["ratelimit-limit"]).toBe("50");
        expect(mocks.list).toHaveBeenCalledTimes(50);
        expect((await get("", 8)).status).toBe(200);
        vi.setSystemTime(new Date("2026-11-06T00:01:00Z"));
        expect((await get()).status).toBe(200);
    });
    it("H02: 400/500も計上し未認証・不正JSONは非計上", async () => {
        for (let i = 0; i < 51; i++) {
            expect((await request(app).get("/api/item-trash/list")).status).toBe(401);
            expect(
                (
                    await request(app)
                        .get("/api/item-trash/list")
                        .set("Authorization", "Bearer " + token())
                        .set("Content-Type", "application/json")
                        .send("{")
                ).status,
            ).toBe(400);
        }
        for (let i = 0; i < 25; i++) expect((await get("?page=0")).status).toBe(400);
        mocks.list.mockRejectedValue(new Error("failure"));
        for (let i = 0; i < 25; i++) expect((await get()).status).toBe(500);
        expect((await get()).status).toBe(429);
        expect(mocks.list).toHaveBeenCalledTimes(25);
    });
});
