import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../../src/errors.js";
import { makeStoredToken, makeUser } from "../../../../fixtures/auth/refreshToken/fixtures.js";

const mocks = vi.hoisted(() => ({ getRefreshTokenOne: vi.fn(), destroyStoredRefreshToken: vi.fn(), getUser: vi.fn() }));
vi.mock("../../../../../src/services/refreshTokens/refreshTokens.js", () => ({ getRefreshTokenOne: mocks.getRefreshTokenOne, destroyStoredRefreshToken: mocks.destroyStoredRefreshToken }));
vi.mock("../../../../../src/services/users/query.js", () => ({ getUser: mocks.getUser }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
let run: typeof import("../../../../../src/usecases/auth/refreshToken.js").refreshTokenUseCase;
let generateRefreshToken: typeof import("../../../../../src/utils/jwtHelper.js").generateRefreshToken;
let secret: string;
let stored: ReturnType<typeof makeStoredToken>;
let user: ReturnType<typeof makeUser>;
beforeAll(async () => {
    secret = randomBytes(32).toString("hex"); vi.stubEnv("NEXTAUTH_SECRET", secret);
    ({ refreshTokenUseCase: run } = await import("../../../../../src/usecases/auth/refreshToken.js"));
    ({ generateRefreshToken } = await import("../../../../../src/utils/jwtHelper.js"));
});
beforeEach(() => {
    vi.resetAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
    stored = makeStoredToken(); user = makeUser();
    mocks.getRefreshTokenOne.mockResolvedValue(stored); mocks.destroyStoredRefreshToken.mockResolvedValue(undefined); mocks.getUser.mockResolvedValue(user);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
afterAll(() => vi.unstubAllEnvs());
const runToken = (token: string) => { stored.token = token; return run({ refreshToken: token }); };
describe("F3-H 実JWT検証とtoken生成helper接続", () => {
    it.each([7, "7", "0007"])("F3-H01: 実generateRefreshTokenのid=%sからaccess tokenを生成", async id => {
        const token = generateRefreshToken({ id, email: user.email }, false);
        const result = await runToken(token);
        expect(result.refreshToken).toBe(token); expect(result.exp).toBe(Math.floor(Date.now() / 1000) + 900);
        expect(jwt.verify(result.accessToken, secret)).toEqual({ id: 7, email: user.email, type: "access", iat: Math.floor(Date.now() / 1000), exp: result.exp });
        expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith({ userId: 7 }); expect(mocks.destroyStoredRefreshToken).not.toHaveBeenCalled();
    });
    it.each([
        { label: "文字列payload", value: "plain-string" }, { label: "id欠落", value: {} },
        { label: "id null", value: { id: null } }, { label: "id小数", value: { id: 1.5 } },
        { label: "id負数", value: { id: -1 } }, { label: "id範囲超過", value: { id: 2147483648 } },
        { label: "id空白", value: { id: " " } }, { label: "id型不正", value: { id: true } },
        { label: "id文字列不正", value: { id: "1e1" } },
    ])("F3-H02: 署名有効でも$labelは401・後続なし", async ({ value }) => {
        const token = jwt.sign(value, secret);
        const failure: unknown = await runToken(token).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(AppError); expect(failure).toMatchObject({ code: "INVALID_DECODE_TOKEN", statusCode: 401 });
        expect(mocks.getUser).not.toHaveBeenCalled(); expect(mocks.destroyStoredRefreshToken).toHaveBeenCalledExactlyOnceWith({ storedToken: stored });
    });
    it.each(["署名不正", "JWT期限切れ"])("F3-H03: %sの既存verify例外を維持しユーザー検索なし", async mode => {
        const token = jwt.sign({ id: 7 }, mode === "署名不正" ? "different-test-secret" : secret, { expiresIn: mode === "JWT期限切れ" ? -1 : 900 });
        await expect(runToken(token)).rejects.toBeInstanceOf(mode === "JWT期限切れ" ? jwt.TokenExpiredError : jwt.JsonWebTokenError);
        expect(mocks.getUser).not.toHaveBeenCalled(); expect(mocks.destroyStoredRefreshToken).not.toHaveBeenCalled();
    });
});
