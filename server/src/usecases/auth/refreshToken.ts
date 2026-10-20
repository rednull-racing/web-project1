import jwt from "jsonwebtoken";
import { AppError } from "../../errors.js";
import { destroyStoredRefreshToken, getRefreshTokenOne } from "../../services/refreshTokens/refreshTokens.js";
import { getUser } from "../../services/users/query.js";
import { generateAccessToken } from "../../utils/jwtHelper.js";

type Params = {
    refreshToken: string;
};

type DecodedAccessToken = {
    id: number | string;
    email: string;
    type: "access";
    iat?: number;
    exp?: number;
};

// POST /auth/refresh-token
// summary: トークンリフレッシュ
// page: middleware
export const refreshTokenUseCase = async ({ refreshToken }: Params) => {
    // トークン取得
    const storedToken = await getRefreshTokenOne({ refreshToken });

    if (!storedToken) throw new AppError("INVALID_TOKEN", 401);
    if (new Date() > storedToken.expires_at) {
        throw new AppError("EXPIRED_TOKEN", 401);
    }

    // デコード
    const decoded = jwt.verify(refreshToken, process.env.NEXTAUTH_SECRET!);
    const payloadId: unknown = typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)
        ? decoded.id
        : undefined;
    const userId = typeof payloadId === "string" && /^\d+$/.test(payloadId) ? Number(payloadId) : payloadId;

    if (typeof userId !== "number" || !Number.isInteger(userId) || userId < 1 || userId > 2147483647) {
        destroyStoredRefreshToken({ storedToken }).catch((err) => {
            console.error("service destroyRefreshToken error:", err);
        });

        throw new AppError("INVALID_DECODE_TOKEN", 401);
    }

    // ユーザー取得
    const user = await getUser({ userId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    // アクセストークン生成
    const newAccessToken = generateAccessToken(user);
    const newDecoded = jwt.decode(newAccessToken) as DecodedAccessToken | null;

    return {
        accessToken: newAccessToken,
        refreshToken: storedToken.token,
        exp: newDecoded?.exp,
    };
};
