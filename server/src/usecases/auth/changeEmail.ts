import crypto from "crypto";
import { AppError } from "../../errors.js";
import { createTokenEmailChange } from "../../services/tokenEmailChange/tokenEmailChange.js";
import { getAllEmail, getUser } from "../../services/users/query.js";

type Params = {
    userId: number;
    newEmail: string;
};

// PATCH /auth/email
// summary: メールアドレス変更リクエスト
// page: /edit/email
export const changeEmailUseCase = async ({ userId, newEmail }: Params) => {
    // user取得
    const user = await getUser({ userId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);
    if (newEmail === user.email) throw new AppError("INVALID_EMAIL", 400);

    // メールアドレス被りチェック
    const emailUser = await getAllEmail({ email: newEmail });

    if (emailUser.length > 0) throw new AppError("ALREADY_USED_EMAIL", 400);

    // トークン発行
    const token = crypto.randomBytes(20).toString("hex");
    const tokenExpires = new Date(Date.now() + 30 * 60 * 1000);

    // トークンDB保存
    await createTokenEmailChange({
        data: {
            token_hash: token,
            expires_at: tokenExpires,
            user_id: userId,
            new_email: newEmail,
        },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const url = `${process.env.CLIENT_URL}/edit/email/new-email/${token}`;

    // メール送信処理
};
