import crypto from "crypto";
import { AppError } from "../../errors.js";
import { createTokenResetPW } from "../../services/tokenPasswordReset/tokenPasswordReset.js";
import { getUserEmailOne } from "../../services/users/query.js";

type Params = {
    email: string;
};

// POST /auth/request-password-reset
// summary: パスワードリセットリクエスト
// page: /login/reset-pw-mail
export const requestPasswordResetUseCase = async ({ email }: Params) => {
    // ユーザー取得
    const user = await getUserEmailOne({ email });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    // pwリセットトークン発行
    const newResetToken = crypto.randomBytes(20).toString("hex");
    const newResetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    // DB登録
    await createTokenResetPW({
        data: {
            token_hash: newResetToken,
            expires_at: newResetTokenExpires,
            user_id: user.id,
        },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const resetUrl = `${process.env.CLIENT_URL}/login/new-pw?token=${newResetToken}`;

    // メール送信処理
};
