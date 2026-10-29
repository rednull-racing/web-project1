import { randomBytes } from "node:crypto";
import express, { type ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeBody, makeDuplicateUiIdBody } from "../../../../fixtures/itemDraft/createItemDraft/fixtures.js";
const mocks = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn() }));
vi.mock("../../../../../src/usecases/itemDraft/getItemDraftPage.js", () => ({ getItemDraftPageUseCase: vi.fn() }));
vi.mock("../../../../../src/usecases/itemDraft/convertItemDraftVideo.js", () => ({
    convertItemDraftVideoUseCase: vi.fn(),
}));
vi.mock("../../../../../src/usecases/itemDraft/createItemDraft.js", () => ({ createItemDraftUseCase: mocks.create }));
vi.mock("../../../../../src/usecases/itemDraft/deleteItemDraft.js", () => ({ deleteItemDraftUseCase: mocks.remove }));
vi.mock("../../../../../src/db.js", () => {
    throw new Error("AF-MOCK01: 作成HTTPテストからDBを初期化しない");
});
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
let app: ReturnType<typeof express>, secret: string;
const token = (id = 7, expiresIn = 3600) =>
    jwt.sign({ id, email: "test@example.test", admin: false }, secret, { expiresIn });
const post = (body: object = makeBody(), userId = 7, suffix = "") =>
    request(app)
        .post(`/api/item-draft${suffix}`)
        .set("Authorization", `Bearer ${token(userId)}`)
        .send(body);
beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    mocks.create.mockResolvedValue({
        itemDraftId: 101,
        videoSignedUrl: null,
        thumbnailSignedUrl: null,
        itemImageSignedUrls: [],
        attributesImageSignedUrls: {},
    });
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date("2026-10-12T00:00:00Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    const { default: router } = await import("../../../../../src/routes/itemDraft.js");
    const { AppError } = await import("../../../../../src/errors.js");
    app = express();
    app.use(express.json());
    app.use("/api/item-draft", router);
    // 共通errorHandlerの保証ではなく、Routerが渡す例外を観測する。
    const observe: ErrorRequestHandler = (err, _req, res, _next) => {
        void _next;
        if (err instanceof AppError) res.status(err.statusCode).json({ code: err.code });
        else res.status(500).json({ code: "TEST_UNEXPECTED_ERROR" });
    };
    app.use(observe);
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    expect(mocks.remove, "AF-MOCK02: 作成要求から削除usecaseを呼ばない").not.toHaveBeenCalled();
});
describe("P0/P1: 実Routerの到達性と優先順位", () => {
    it.each(["なし", "Bearer不正", "署名不正", "期限切れ"])("R01 R06: トークン%sは401で停止", async (mode) => {
        const req = request(app).post("/api/item-draft");
        if (mode === "Bearer不正") req.set("Authorization", `Basic ${token()}`);
        if (mode === "署名不正") req.set("Authorization", `Bearer ${jwt.sign({ id: 7 }, "different-test-key")}`);
        if (mode === "期限切れ") req.set("Authorization", `Bearer ${token(7, -1)}`);
        const result = await req.send({});
        expect(result.status).toBe(401);
        expect(result.body).toEqual({
            message: ["なし", "Bearer不正"].includes(mode) ? "トークンがありません。" : "トークンが無効です。",
        });
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it("R01: 未認証6回は認証済みユーザーの制限枠を消費しない", async () => {
        for (let i = 0; i < 6; i++) expect((await request(app).post("/api/item-draft").send({})).status).toBe(401);
        for (let i = 0; i < 5; i++) expect((await post()).status).toBe(200);
        expect((await post()).status).toBe(429);
        expect(mocks.create).toHaveBeenCalledTimes(5);
    });
    it("AF-R01 R02 O01: 正常JWTとbodyでusecaseへ到達し下書きIDと署名4項目を200で返す", async () => {
        const signed = {
            itemDraftId: 202,
            videoSignedUrl: { url: "upload", fields: { key: "video" } },
            thumbnailSignedUrl: "thumb",
            itemImageSignedUrls: [{ index: 0, url: "image" }],
            attributesImageSignedUrls: { red: "red" },
        };
        mocks.create.mockResolvedValue(signed);
        const result = await post();
        expect(result.status).toBe(200);
        expect(result.body).toEqual(signed);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, body: makeBody() });
    });
    it.each(["空body", "ID欠落", "IDゼロ", "ID文字列", "価格不正", "重複uiId", "ENUM不正", "文字数超過"])(
        "AF-R02 R03: %sはINVALID_BODYでusecase未実行",
        async (mode) => {
            const body = mode === "重複uiId" ? makeDuplicateUiIdBody() : makeBody();
            if (mode === "ID欠落") Reflect.deleteProperty(body, "itemEditingId");
            if (mode === "IDゼロ") body.itemEditingId = 0;
            if (mode === "ID文字列") Object.assign(body, { itemEditingId: "11" });
            if (mode === "価格不正") body.price = 299;
            if (mode === "ENUM不正") Object.assign(body.genderAge, { gender: "invalid" });
            if (mode === "文字数超過") body.itemMeta.name = "あ".repeat(256);
            const result = await post(mode === "空body" ? {} : body);
            expect(result.status).toBe(400);
            expect(result.body).toEqual({ code: "INVALID_BODY" });
            expect(mocks.create).not.toHaveBeenCalled();
        },
    );
    it("AF-R05 C01 V18: 混入した所有者・item_id・queryのidを採用しない", async () => {
        const body = { ...makeBody(), userId: 999, seller_id: 999, item_id: 777 };
        const result = await post(body, 7, "?id=999");
        expect(result.status).toBe(200);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, body: makeBody() });
    });
    it("AF-R04 R04: 正常5回・6回目429、別ユーザーと時間窓更新後は200", async () => {
        for (let i = 0; i < 5; i++) expect((await post()).status).toBe(200);
        expect((await post()).status).toBe(429);
        expect((await post(makeBody(), 8)).status).toBe(200);
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1);
        expect((await post()).status).toBe(200);
        expect(mocks.create).toHaveBeenCalledTimes(7);
    });
    it("AF-R04 R05 R06: 不正入力も加算され6回目はbody検証より先に429", async () => {
        for (let i = 0; i < 5; i++) expect((await post({})).body).toEqual({ code: "INVALID_BODY" });
        expect((await post()).status).toBe(429);
        expect((await post({})).status).toBe(429);
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it("AF-R03: 期限切れトークンと不正bodyを6回送っても認証済み枠を消費しない", async () => {
        for (let i = 0; i < 6; i++) {
            expect(
                (
                    await request(app)
                        .post("/api/item-draft")
                        .set("Authorization", `Bearer ${token(7, -1)}`)
                        .send({})
                ).status,
            ).toBe(401);
        }
        for (let i = 0; i < 5; i++) expect((await post()).status).toBe(200);
        expect((await post()).status).toBe(429);
        expect(mocks.create).toHaveBeenCalledTimes(5);
    });
    it("R07: 存在しないid付きパスは404", async () => {
        expect((await post(makeBody(), 7, "/11")).status).toBe(404);
        expect(mocks.create).not.toHaveBeenCalled();
    });
});
