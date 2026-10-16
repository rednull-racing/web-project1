import bcrypt from "bcrypt";
import { AppError } from "../../errors.js";
import { createRefreshToken, destroyRefreshToken } from "../../services/refreshTokens/refreshTokens.js";
import { getUserEmailOne } from "../../services/users/query.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwtHelper.js";

type Params = {
    email: string;
    password: string;
    rememberMe: boolean;
};

// POST /auth/login
// summary: ログイン
// page: /login
export const loginUseCase = async ({ email, password, rememberMe }: Params) => {
    // User取得
    const user = await getUserEmailOne({ email });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);
    if (!user.email_verified) throw new AppError("INVALID_USER", 401);

    // パスワード照合
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) throw new AppError("PASSWORD_IS_NOT_MATCH", 401);

    const userId = user.id;

    // トークン生成
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user, rememberMe);

    await destroyRefreshToken({ userId });

    const expiresAt = rememberMe
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    await createRefreshToken({
        data: {
            token: newRefreshToken,
            user_id: userId,
            expires_at: expiresAt,
        },
    });

    return {
        id: userId,
        userName: user.user_name,
        admin: user.admin,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
    };
};
