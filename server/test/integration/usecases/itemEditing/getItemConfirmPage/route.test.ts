import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeHttpApp, makeToken } from "../../../../fixtures/itemEditing/getItemConfirmPage/httpFixtures.js";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../../../src/usecases/itemEditing/getItemConfirmPage.js", () => ({ getItemConfirmPageUseCase: mocks.get }));
vi.mock("../../../../../src/usecases/itemEditing/convertItemEditingVideo.js", () => ({
    convertItemEditingVideoUseCase: vi.fn(),
}));
vi.mock("../../../../../src/usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.js", () => ({
    createItemEditingCopyUseCase: vi.fn(),
}));
vi.mock("../../../../../src/usecases/itemEditing/createItemEditing.js", () => ({ createItemEditingUseCase: vi.fn() }));
vi.mock("../../../../../src/usecases/itemEditing/createItemEditingDraft.js", () => ({
    createItemEditingDraftUseCase: vi.fn(),
}));
vi.mock("../../../../../src/usecases/itemEditing/updateConfirm.js", () => ({
    updateItemEditingConfirmUseCase: vi.fn(),
}));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));

let app: Awaited<ReturnType<typeof makeHttpApp>>, secret: string;
const get = (id = "123", userId = 7) => request(app).get("/api/item-editing/" + id + "/confirm").set("Authorization", "Bearer " + makeToken(secret, userId));
beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-30T00:00:00Z"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    app = await makeHttpApp();
    mocks.get.mockResolvedValue({ id: 123, duration: 17, item_id: null, updatedAt: new Date("2026-10-29T00:00:00Z") });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("P0 HTTP契約と拒否時の停止", () => {
    it("H01: 認証IDと数値paramsだけ採用し200 JSONを返す", async () => {
        const result = await get().query({ userId: 8, seller_id: 8 }).send({ userId: 8, seller_id: 8 });
        expect(result.status).toBe(200);
        expect(result.body).toEqual({ itemEditing: { id: 123, duration: 17, item_id: null, updatedAt: "2026-10-29T00:00:00.000Z" } });
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 123, userId: 7 });
    });
    it.each(["なし", "空", "署名不正", "期限切れ"])("H02: %sは不正idより先に401", async mode => {
        const req = request(app).get("/api/item-editing/no/confirm");
        if (mode === "空") req.set("Authorization", "Bearer ");
        if (mode === "署名不正") req.set("Authorization", "Bearer " + makeToken("wrong"));
        if (mode === "期限切れ") req.set("Authorization", "Bearer " + makeToken(secret, 7, -1));
        const result = await req;
        expect(result.status).toBe(401);
        expect(result.body).toEqual({ message: mode === "なし" || mode === "空" ? "トークンがありません。" : "トークンが無効です。" });
        expect(mocks.get).not.toHaveBeenCalled();
    });
    it.each(["1", "2147483647", "1e2", "0x10", "001", "%201%20"])("H03: coerce可能な%sを採用", async id => {
        expect((await get(id)).status).toBe(200);
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ itemEditingId: Number(decodeURIComponent(id)), userId: 7 });
    });
    it.each(["0", "-1", "1.5", "abc", "2147483648", "Infinity", "NaN", "%20"])("H03: %sは400で後続未実行", async id => {
        const result = await get(id);
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ code: "INVALID_PARAMS", message: "INVALID_PARAMS" });
        expect(mocks.get).not.toHaveBeenCalled();
    });
    it.each([404, 500])("H04: %sの公開応答と内部情報非公開", async status => {
        const { AppError } = await import("../../../../../src/errors.js");
        mocks.get.mockRejectedValue(status === 404 ? new AppError("ITEM_EDITING_NOT_FOUND", 404) : new Error("private SQL"));
        const result = await get();
        expect(result.status).toBe(status);
        expect(result.body).toEqual(status === 404 ? { code: "ITEM_EDITING_NOT_FOUND", message: "ITEM_EDITING_NOT_FOUND" } : { error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" });
    });
});
const consume = async () => { for (let i = 0; i < 50; i++) expect((await get()).status).toBe(200); };
describe("P1 実制限とparserの優先順位", () => {
    it("H05: 50回許可/51回目拒否、対象変更は同枠、別ユーザー別枠", async () => {
        await consume();
        const result = await get("456");
        expect(result.status).toBe(429);
        expect(result.text).toBe("Too many requests, please try again later.");
        expect(result.headers["retry-after"]).toBe("60");
        expect(result.headers["ratelimit-limit"]).toBe("50");
        expect(result.headers["x-ratelimit-limit"]).toBeUndefined();
        expect((await get("123", 8)).status).toBe(200);
        expect(mocks.get).toHaveBeenCalledTimes(51);
    });
    it.each([59999, 60000, 60001])("H06: 窓境界%s ms", async elapsed => {
        await consume();
        await vi.advanceTimersByTimeAsync(elapsed);
        expect((await get()).status).toBe(elapsed < 60000 ? 429 : 200);
    });
    it.each([400, 404, 500])("H07: %sも計上、超過はparamsより優先", async status => {
        const { AppError } = await import("../../../../../src/errors.js");
        if (status !== 400) mocks.get.mockRejectedValue(status === 404 ? new AppError("ITEM_EDITING_NOT_FOUND", 404) : new Error("private"));
        for (let i = 0; i < 50; i++) expect((await get(status === 400 ? "no" : "123")).status).toBe(status);
        expect((await get("no")).status).toBe(429);
        expect(mocks.get).toHaveBeenCalledTimes(status === 400 ? 0 : 50);
    });
    it.each(["未認証", "不正JSON"])("H08: %sは枠未消費", async mode => {
        for (let i = 0; i < 51; i++) {
            const req = request(app).get("/api/item-editing/no/confirm");
            if (mode === "不正JSON") req.set("Content-Type", "application/json").send('{"private":');
            const result = await req;
            expect(result.status).toBe(mode === "未認証" ? 401 : 400);
            expect(result.body).toEqual(mode === "未認証" ? { message: "トークンがありません。" } : { code: "INVALID_JSON", message: "JSONの形式を確認してください。" });
        }
        expect(mocks.get).not.toHaveBeenCalled();
        await consume();
        expect((await get()).status).toBe(429);
    });
});
