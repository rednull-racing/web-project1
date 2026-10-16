import crypto from "crypto";
import { AppError } from "../../errors.js";
import { getTokenReissueOne, updateReissueToken } from "../../services/tokenSignupVerificationCode/tokenSignupVerificationCode.js";

type Params = {
    token: string;
};

// POST /auth/resend-verification-code
// summary: 認証コード再送信
// page: /signup/verify
export const resendVerificationCodeUseCase = async ({ token }: Params) => {
    // トークン照合
    const tokenRecord = await getTokenReissueOne({ token });

    if (!tokenRecord) throw new AppError("TOKEN_NOT_FOUND", 404);
    if (!tokenRecord.User) throw new AppError("USER_NOT_FOUND", 404);
    if (new Date() > new Date(tokenRecord.reissue_token_expires)) {
        throw new AppError("EXPIRED_TOKEN", 410);
    }

    // 新しいトークン発行
    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const newReissueToken = crypto.randomBytes(20).toString("hex");
    const newReissueTokenExpires = new Date(Date.now() + 30 * 60 * 1000);

    // db更新
    await updateReissueToken({
        tokenRecord,
        data: {
            verification_code: newVerificationCode,
            verification_code_expires: newExpiresAt,
            reissue_token: newReissueToken,
            reissue_token_expires: newReissueTokenExpires,
        },
    });

    const reissueUrl = `${process.env.CLIENT_URL}/signup/verify?token=${newReissueToken}`;

    // メール送信処理

    return {
        expiresAt: newExpiresAt,
        reissueUrl,
    };
};
