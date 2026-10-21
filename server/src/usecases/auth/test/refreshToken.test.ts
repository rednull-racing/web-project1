import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";
import { refreshTokenUseCase } from "../refreshToken.js";
import { deferred, makeStoredToken, makeUser } from "../../../../test/fixtures/auth/refreshToken/fixtures.js";

const mocks = vi.hoisted(() => ({
    getRefreshTokenOne: vi.fn(),
    destroyStoredRefreshToken: vi.fn(),
    getUser: vi.fn(),
    verify: vi.fn(),
    decode: vi.fn(),
    generateAccessToken: vi.fn(),
}));
vi.mock("jsonwebtoken", () => ({ default: { verify: mocks.verify, decode: mocks.decode } }));
vi.mock("../../../services/refreshTokens/refreshTokens.js", () => ({
    getRefreshTokenOne: mocks.getRefreshTokenOne,
    destroyStoredRefreshToken: mocks.destroyStoredRefreshToken,
}));
vi.mock("../../../services/users/query.js", () => ({ getUser: mocks.getUser }));
vi.mock("../../../utils/jwtHelper.js", () => ({ generateAccessToken: mocks.generateAccessToken }));
let stored: ReturnType<typeof makeStoredToken>;
let user: ReturnType<typeof makeUser>;
const run = () => refreshTokenUseCase({ refreshToken: "request-refresh-token" });
beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
    vi.stubEnv("NEXTAUTH_SECRET", "test-only-unit-secret");
    stored = makeStoredToken();
    user = makeUser();
    mocks.getRefreshTokenOne.mockResolvedValue(stored);
    mocks.destroyStoredRefreshToken.mockResolvedValue(undefined);
    mocks.verify.mockReturnValue({ id: 7, email: user.email, type: "refresh" });
    mocks.getUser.mockResolvedValue(user);
    mocks.generateAccessToken.mockReturnValue("new-access-token");
    mocks.decode.mockReturnValue({ exp: 1792455300 });
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

const expectInvalidPayload = async () => {
    const failure: unknown = await run().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect(failure).toMatchObject({ code: "INVALID_DECODE_TOKEN", statusCode: 401 });
    expect(mocks.destroyStoredRefreshToken).toHaveBeenCalledExactlyOnceWith({ storedToken: stored });
    expect(mocks.destroyStoredRefreshToken.mock.calls[0][0].storedToken).toBe(stored);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.generateAccessToken).not.toHaveBeenCalled();
    expect(mocks.decode).not.toHaveBeenCalled();
};
describe("F3-U01 正常payload・ID互換性", () => {
    it.each([1, 7, 2147483647, "1", "7", "0007", "2147483647"])(
        "F3-U01: ID=%sを数値IDで渡し既存の応答を維持",
        async (id) => {
            user.id = Number(id);
            stored.user_id = Number(id);
            mocks.verify.mockReturnValue({ id, email: user.email, type: "refresh" });
            expect(await run()).toEqual({
                accessToken: "new-access-token",
                refreshToken: stored.token,
                exp: 1792455300,
            });
            expect(mocks.getRefreshTokenOne).toHaveBeenCalledExactlyOnceWith({ refreshToken: "request-refresh-token" });
            expect(mocks.verify).toHaveBeenCalledExactlyOnceWith("request-refresh-token", "test-only-unit-secret");
            expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith({ userId: Number(id) });
            expect(mocks.generateAccessToken).toHaveBeenCalledExactlyOnceWith(user);
            expect(mocks.generateAccessToken.mock.calls[0][0]).toBe(user);
            expect(mocks.decode).toHaveBeenCalledExactlyOnceWith("new-access-token");
            expect(mocks.destroyStoredRefreshToken).not.toHaveBeenCalled();
        },
    );
    it("F3-U01: 既存契約どおりid以外のclaimを今回必須化しない", async () => {
        mocks.verify.mockReturnValue({ id: 7 });
        expect(await run()).toHaveProperty("accessToken", "new-access-token");
    });
});
describe("F3-U02 不正payload・IDは401でユーザー検索前に停止", () => {
    it.each([
        { label: "文字列payload", value: "not-an-object" },
        { label: "id欠落", value: {} },
        { label: "payload null（verify境界へ防御注入）", value: null },
        { label: "配列（防御注入）", value: [{ id: 7 }] },
        { label: "undefined（防御注入）", value: undefined },
    ])("F3-U02: $label", async ({ value }) => {
        mocks.verify.mockReturnValue(value);
        await expectInvalidPayload();
    });
    it.each([
        { label: "null", value: null },
        { label: "undefined", value: undefined },
        { label: "0", value: 0 },
        { label: "負数", value: -1 },
        { label: "小数", value: 1.5 },
        { label: "INTEGER超過", value: 2147483648 },
        { label: "NaN（防御注入）", value: NaN },
        { label: "Infinity（防御注入）", value: Infinity },
        { label: "-Infinity（防御注入）", value: -Infinity },
        { label: "空文字", value: "" },
        { label: "空白", value: " " },
        { label: "前後空白", value: " 7 " },
        { label: "数値以外", value: "user" },
        { label: "指数表記", value: "1e1" },
        { label: "小数字符列", value: "7.0" },
        { label: "文字列0", value: "0" },
        { label: "文字列負数", value: "-1" },
        { label: "文字列範囲超過", value: "2147483648" },
        { label: "真偽値", value: true },
        { label: "配列", value: [7] },
        { label: "オブジェクト", value: { id: 7 } },
    ])("F3-U02: 不正ID $label", async ({ value }) => {
        mocks.verify.mockReturnValue({ id: value });
        await expectInvalidPayload();
    });
});
describe("F3-U03 既存の保存済みトークン・依存エラー・失敗許容削除", () => {
    it("F3-U03: 保存済みトークンなしはINVALID_TOKEN", async () => {
        mocks.getRefreshTokenOne.mockResolvedValue(null);
        await expect(run()).rejects.toMatchObject({ code: "INVALID_TOKEN", statusCode: 401 });
        expect(mocks.verify).not.toHaveBeenCalled();
        expect(mocks.destroyStoredRefreshToken).not.toHaveBeenCalled();
        expect(mocks.getUser).not.toHaveBeenCalled();
    });
    it("F3-U03: 保存期限切れはEXPIRED_TOKENでverify前に停止", async () => {
        stored.expires_at = new Date(Date.now() - 1);
        await expect(run()).rejects.toMatchObject({ code: "EXPIRED_TOKEN", statusCode: 401 });
        expect(mocks.verify).not.toHaveBeenCalled();
        expect(mocks.getUser).not.toHaveBeenCalled();
    });
    it("F3-U03: 保存期限と現在時刻が等しい既存の境界を維持", async () => {
        stored.expires_at = new Date();
        expect(await run()).toHaveProperty("accessToken", "new-access-token");
    });
    it("F3-U03: ユーザーなしはUSER_NOT_FOUNDを維持", async () => {
        mocks.getUser.mockResolvedValue(null);
        await expect(run()).rejects.toMatchObject({ code: "USER_NOT_FOUND", statusCode: 404 });
        expect(mocks.generateAccessToken).not.toHaveBeenCalled();
        expect(mocks.destroyStoredRefreshToken).not.toHaveBeenCalled();
    });
    it.each(["getRefreshTokenOne", "getUser"] as const)("F3-U03: %sの同一Error伝播", async (name) => {
        const failure = new Error("dependency failure");
        mocks[name].mockRejectedValue(failure);
        await expect(run()).rejects.toBe(failure);
        expect(mocks.generateAccessToken).not.toHaveBeenCalled();
        expect(mocks.destroyStoredRefreshToken).not.toHaveBeenCalled();
    });
    it("F3-U03: verifyが投げた同一Errorの既存の伝播を維持", async () => {
        const failure = new Error("verification failure");
        mocks.verify.mockImplementation(() => {
            throw failure;
        });
        await expect(run()).rejects.toBe(failure);
        expect(mocks.getUser).not.toHaveBeenCalled();
        expect(mocks.generateAccessToken).not.toHaveBeenCalled();
        expect(mocks.destroyStoredRefreshToken).not.toHaveBeenCalled();
    });
    it("F3-U03: 不正payloadでは削除完了を待たず401、削除失敗は捕捉", async () => {
        const gate = deferred<void>();
        const failure = new Error("cleanup failure");
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.verify.mockReturnValue({});
        mocks.destroyStoredRefreshToken.mockReturnValue(gate.promise);
        try {
            await expectInvalidPayload();
            expect(log).not.toHaveBeenCalled();
        } finally {
            gate.reject(failure);
            await gate.promise.catch(() => {});
        }
        expect(log).toHaveBeenCalledExactlyOnceWith("service destroyRefreshToken error:", failure);
    });
});
