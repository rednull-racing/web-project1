import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { createAddressFirst } from "../../services/address/address.js";
import { createBankAccountFirst } from "../../services/bankAccount/bankAccount.js";
import { createIdCardFirst } from "../../services/idCard/idCard.js";
import { createNameFirst } from "../../services/name/name.js";
import { createInputCode } from "../../services/referenceCode/referenceCode.js";
import { createRefreshToken } from "../../services/refreshTokens/refreshTokens.js";
import {
    destroyToken,
    getTokenVerificationOne,
} from "../../services/tokenSignupVerificationCode/tokenSignupVerificationCode.js";
import { emailVerifyUser } from "../../services/users/command.js";
import { getUser } from "../../services/users/query.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwtHelper.js";

type Params = {
    verificationCode: string;
    rememberMe: boolean;
    referenceCode?: string;
};

// POST /auth/signup-verify
// summary: サインアップコード認証
// page: /signup/verify
export const signupVerifyUseCase = async ({ verificationCode, rememberMe, referenceCode }: Params) => {
    // 認証コード照合
    const tokenRecord = await getTokenVerificationOne({ verificationCode });

    if (!tokenRecord) throw new AppError("TOKEN_NOT_FOUND", 404);
    if (new Date() > new Date(tokenRecord.reissue_token_expires)) {
        throw new AppError("EXPIRED_TOKEN", 401);
    }

    // user取得
    const user = await getUser({ userId: tokenRecord.user_id });

    if (!user) {
        destroyToken({ tokenRecord }).catch((err) => {
            console.error("service tokenSignupVerificationCode destroyToken error:", err);
        });

        throw new AppError("USER_NOT_FOUND", 404);
    }

    // アクセストークン発行
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user, rememberMe);

    const expiresAt = rememberMe
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const userId = user.id;

    // db更新
    await sequelize.transaction(async (t) => {
        await createRefreshToken({
            data: {
                token: newRefreshToken,
                user_id: userId,
                expires_at: expiresAt,
            },
            transaction: t,
        });

        const address = await createAddressFirst({ transaction: t });

        const name = await createNameFirst({ transaction: t });

        const bankAccount = await createBankAccountFirst({ transaction: t });

        const idCard = await createIdCardFirst({ transaction: t });

        await emailVerifyUser({
            user,
            data: {
                email_verified: true,
                address_id: address.id,
                name_id: name.id,
                account_id: bankAccount.id,
                idcard_id: idCard.id,
            },
            transaction: t,
        });
    });

    destroyToken({ tokenRecord }).catch((err) => {
        console.error("service tokenSignupVerificationCode destroyToken error:", err);
    });

    // 紹介コード入力DB登録
    if (referenceCode) {
        createInputCode({
            data: {
                input: referenceCode,
                input_user_id: userId,
            },
        }).catch((err) => {
            console.error("service createInputCode referenceCode error:", err);
        });
    }

    return {
        id: userId,
        email: user.email,
        userName: user.user_name,
        admin: user.admin,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
    };
};
