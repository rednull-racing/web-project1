import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeHttpApp, makeToken, postCopy } from "../../../../../server/test/usecases/itemEditing/createItemEditingCopy/httpFixtures.js";

const mocks = vi.hoisted(() => ({ copy: vi.fn() }));
vi.mock("../../../../../server/src/usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.js", () => ({ createItemEditingCopyUseCase: mocks.copy }));
vi.mock("../../../../../server/src/usecases/itemEditing/createItemEditing.js", () => ({ createItemEditingUseCase: vi.fn() }));
vi.mock("../../../../../server/src/usecases/itemEditing/createItemEditingDraft.js", () => ({ createItemEditingDraftUseCase: vi.fn() }));
vi.mock("../../../../../server/src/usecases/itemEditing/updateConfirm.js", () => ({ updateItemEditingConfirmUseCase: vi.fn() }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
let app: Awaited<ReturnType<typeof makeHttpApp>>, secret: string;
const post = (body: object = { itemId: 101 }, userId = 7) => postCopy(app, secret, body, userId);
beforeEach(async () => {
    vi.resetModules(); vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-15T00:00:00Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    app = await makeHttpApp();
    mocks.copy.mockResolvedValue(456);
});
afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs();
});

describe("P1 実Router・認証・validator・共通errorHandler", () => {
    it("R01 C02 V05 R11: 正常bodyと混入値から認証ID/itemIdだけを採用して201を返す", async () => {
        const result = await post({
            itemId: 101, userId: 8, seller_id: 8, itemEditingId: 999,
            price: 1, name: "改ざん", status: "soldout", attributes: { inventory: 999 },
        });
        expect(result.status).toBe(201); expect(result.body).toEqual({ itemEditingId: 456 });
        expect(mocks.copy).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemId: 101 });
    });
    it.each(["なし", "Bearer空", "不正署名", "期限切れ"])("R02: %sと不正bodyでは401を優先する", async (mode) => {
        const req = request(app).post("/api/item-editing/copy");
        if (mode === "Bearer空") req.set("Authorization", "Bearer ");
        if (mode === "不正署名") req.set("Authorization", "Bearer " + makeToken("different-secret"));
        if (mode === "期限切れ") req.set("Authorization", "Bearer " + makeToken(secret, 7, -1));
        const result = await req.send({});
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            message: mode === "なし" || mode === "Bearer空" ? "トークンがありません。" : "トークンが無効です。",
        });
        expect(mocks.copy).not.toHaveBeenCalled();
    });
    it.each([{}, { itemId: 0 }, { itemId: "101" }, { itemId: 1.5 }, { itemId: null }])(
        "R03 V01 V02 V04: body=%jは400でusecase未実行", async (body) => {
            const result = await post(body);
            expect(result.status).toBe(400);
            expect(result.body).toEqual({ code: "INVALID_BODY", message: "INVALID_BODY" });
            expect(mocks.copy).not.toHaveBeenCalled();
        },
    );
    it.each(["404", "500"])("R04: usecaseの%sエラーを実handlerで応答する", async (mode) => {
        const { AppError } = await import("../../../../../server/src/errors.js");
        const error = mode === "404" ? new AppError("ITEM_NOT_FOUND", 404) : new Error("secret SQL detail");
        mocks.copy.mockRejectedValue(error);
        const result = await post();
        expect(result.status).toBe(Number(mode));
        expect(result.body).toEqual(mode === "404"
            ? { code: "ITEM_NOT_FOUND", message: "ITEM_NOT_FOUND" }
            : { error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
        expect(JSON.stringify(result.body)).not.toContain("secret SQL detail");
    });
});

describe("P2 実レート制限・優先順位", () => {
    const consume = async () => {
        for (let i = 0; i < 5; i++) expect((await post()).status).toBe(201);
    };
    it("R05: 5回許可・6/7回目429で標準ヘッダーだけを返す", async () => {
        await consume();
        for (let i = 0; i < 2; i++) {
            const result = await post();
            expect(result.status).toBe(429);
            expect(Object.keys(result.headers).some((key) => key.startsWith("ratelimit"))).toBe(true);
            expect(Object.keys(result.headers).some((key) => key.startsWith("x-ratelimit"))).toBe(false);
        }
        expect(mocks.copy).toHaveBeenCalledTimes(5);
    });
    it("R06: 同じIPの別ユーザーは別枠、同じユーザーの別Itemは同じ枠", async () => {
        await consume();
        expect((await post({ itemId: 202 })).status).toBe(429);
        expect((await post({ itemId: 101 }, 8)).status).toBe(201);
        expect(mocks.copy).toHaveBeenCalledTimes(6);
    });
    it.each([599999, 600000, 600001])("R07: 窓開始から%s msでの境界を検証する", async (elapsed) => {
        await consume();
        await vi.advanceTimersByTimeAsync(elapsed);
        expect((await post()).status).toBe(elapsed < 600000 ? 429 : 201);
        expect(mocks.copy).toHaveBeenCalledTimes(elapsed < 600000 ? 5 : 6);
    });
    it.each([400, 404, 500])("R08: %sの失敗も5回で消費し6回目は429", async (status) => {
        const { AppError } = await import("../../../../../server/src/errors.js");
        if (status !== 400) mocks.copy.mockRejectedValue(
            status === 404 ? new AppError("ITEM_NOT_FOUND", 404) : new Error("failed"),
        );
        for (let i = 0; i < 5; i++) expect((await post(status === 400 ? {} : { itemId: 101 })).status).toBe(status);
        expect((await post({})).status).toBe(429);
        expect(mocks.copy).toHaveBeenCalledTimes(status === 400 ? 0 : 5);
    });
    it("R09: 未認証はユーザーの枠を消費しない", async () => {
        for (let i = 0; i < 6; i++) {
            expect((await request(app).post("/api/item-editing/copy").send({})).status).toBe(401);
        }
        await consume(); expect((await post()).status).toBe(429);
        expect(mocks.copy).toHaveBeenCalledTimes(5);
    });
    it("R10: 制限超過はbody不正より先、未認証は両方より先に拒否する", async () => {
        await consume();
        expect((await post({})).status).toBe(429);
        expect((await request(app).post("/api/item-editing/copy").send({})).status).toBe(401);
        expect(mocks.copy).toHaveBeenCalledTimes(5);
    });
});
