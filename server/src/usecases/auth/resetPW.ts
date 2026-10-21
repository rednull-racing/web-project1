import bcrypt from "bcrypt";
import { AppError } from "../../errors.js";
import { deleteTokenRecord, getTokenOne } from "../../services/tokenPasswordReset/tokenPasswordReset.js";
import { updatePasswordUser } from "../../services/users/command.js";
import { getUser } from "../../services/users/query.js";

type Params = {
    token: string;
    password: string;
};

// POST /auth/reset-pw
// summary: パスワードリセット
// page: /login/new-pw
export const resetPWUseCase = async ({ token, password }: Params) => {
    // トークン照合
    const resetRecord = await getTokenOne({ token });

    if (!resetRecord) throw new AppError("TOKEN_NOT_FOUND", 404);
    if (resetRecord.expires_at.getTime() < Date.now()) throw new AppError("EXPIRED_TOKEN", 401);

    // ユーザー取得
    const user = await getUser({ userId: resetRecord.user_id });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);
    if (!user.email_verified) {
        deleteTokenRecord({ resetRecord }).catch((err) => {
            console.error("service tokenPasswordReset resetTokenRecord error:", err);
        });
        throw new AppError("INVALID_USER", 403);
    }

    // パスワードバリデーションチェック
    const regex = /^(?=.*[a-z])(?=.*\d)[a-zA-Z\d]{8,}$/;

    if (!regex.test(password)) throw new AppError("INVALID_PASSWORD", 400);

    // パスワードハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // パスワード更新
    await updatePasswordUser({
        user,
        data: {
            password: hashedPassword,
        },
    });

    // トークン削除
    deleteTokenRecord({ resetRecord }).catch((err) => {
        console.error("service tokenPasswordReset resetTokenRecord error:", err);
    });
};
