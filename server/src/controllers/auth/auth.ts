import type { NextFunction, Request, Response } from "express-serve-static-core";
import { AppError } from "../../errors.js";
import { changeEmailUseCase } from "../../usecases/auth/changeEmail.js";
import { changePwUseCase } from "../../usecases/auth/changePW.js";
import { loginUseCase } from "../../usecases/auth/login.js";
import { changeNewEmailUseCase } from "../../usecases/auth/newEmail.js";
import { refreshTokenUseCase } from "../../usecases/auth/refreshToken.js";
import { rehashPasswordUseCase } from "../../usecases/auth/rehashPassword.js";
import { requestPasswordResetUseCase } from "../../usecases/auth/requestPasswordReset.js";
import { resendVerificationCodeUseCase } from "../../usecases/auth/resendVerificationCode.js";
import { resetPWUseCase } from "../../usecases/auth/resetPW.js";
import { signupUseCase } from "../../usecases/auth/signup.js";
import { signupVerifyUseCase } from "../../usecases/auth/signupVerify.js";
import {
    getClearAccessTokenCookieOptions,
    getClearRefreshTokenCookieOptions,
    getRefreshTokenCookieOptions,
} from "../../utils/getRefreshCookies.js";
import {
    ChangePWBody,
    EmailBody,
    EmailPasswordBody,
    LoginBody,
    ResetPWBody,
    SetCookieBody,
    SignupVerifyBody,
    VerifyTokenBody,
} from "../../validators/body/auth.js";
import { NewEmailTokenQuery } from "../../validators/query/auth.js";

// POST /auth/login
// summary: ログイン
// page: /login
export const authPostLoginController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = req.validatedBody as LoginBody;

        const { email, password, rememberMe } = body;

        const { id, userName, admin, accessToken, refreshToken } = await loginUseCase({
            email,
            password,
            rememberMe,
        });

        res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions(rememberMe));

        res.status(200).json({
            id,
            email,
            user_name: userName,
            admin,
            rememberMe,
            accessToken,
            refreshToken,
        });
    } catch (err) {
        next(err);
    }
};

// POST /auth/set-cookie
// summary: クッキーセット
// page: /my-page
export const authPostSetCookieController = async (req: Request, res: Response): Promise<void> => {
    const body = req.validatedBody as SetCookieBody;

    const { refreshToken, rememberMe } = body;

    res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions(rememberMe));

    res.status(200).json({ message: "Cookieをセットしました" });
};

// POST /auth/clear-cookie
// summary: クッキー削除
// page: /my-page
export const authPostClearCookieController = async (req: Request, res: Response): Promise<void> => {
    res.clearCookie("access-token", getClearAccessTokenCookieOptions());
    res.clearCookie("refreshToken", getClearRefreshTokenCookieOptions());

    res.status(200).json({ message: "Cookieを削除しました" });
};

// POST /auth/signup
// summary: サインアップ
// page: /signup
export const authPostSignupController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = req.validatedBody as EmailPasswordBody;

        const { email, password } = body;

        const { expiresAt, reissueUrl } = await signupUseCase({
            email,
            password,
        });

        res.status(201).json({
            message: "サインアップ成功！認証コードを送信しました！",
            expiresAt,
            reissueUrl,
        });
    } catch (err) {
        next(err);
    }
};

// POST /auth/resend-verification-code
// summary: 認証コード再送信
// page: /signup/verify
export const authPostResendVerificationCodeController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const body = req.validatedBody as VerifyTokenBody;

        const { expiresAt, reissueUrl } = await resendVerificationCodeUseCase({
            token: body.token,
        });

        res.status(200).json({
            message: "新しい認証コードを発行しました。",
            expiresAt,
            reissueUrl,
        });
    } catch (err) {
        next(err);
    }
};

// POST /auth/signup-verify
// summary: サインアップコード認証
// page: /signup/verify
export const authPostSignupVerifyController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const body = req.validatedBody as SignupVerifyBody;

        const { verificationCode, rememberMe, referenceCode } = body;

        const { id, email, userName, admin, accessToken, refreshToken } = await signupVerifyUseCase({
            verificationCode,
            rememberMe,
            referenceCode,
        });

        res.status(200).json({
            id,
            email,
            user_name: userName,
            admin,
            rememberMe,
            accessToken,
            refreshToken,
        });
    } catch (err) {
        next(err);
    }
};

// POST /auth/request-password-reset
// summary: パスワードリセットリクエスト
// page: /login/reset-pw-mail
export const authPostRequestPasswordResetController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const body = req.validatedBody as EmailBody;

        await requestPasswordResetUseCase({ email: body.email });

        res.status(200).json({ message: "メールを送信しました。" });
    } catch (err) {
        next(err);
    }
};

// POST /auth/reset-pw
// summary: パスワードリセット
// page: /login/new-pw
export const authPostResetPwController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = req.validatedBody as ResetPWBody;

        const { token, password } = body;

        await resetPWUseCase({ token, password });

        res.status(200).json({ message: "パスワードを更新しました。" });
    } catch (err) {
        next(err);
    }
};

// PATCH /auth/change-pw
// summary: パスワード変更
// page: /edit/password
export const authPatchChangePwController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const body = req.validatedBody as ChangePWBody;

        const { currentPw, newPw } = body;

        await changePwUseCase({ userId, currentPw, newPw });

        res.status(200).json({ message: "パスワードを更新しました " });
    } catch (err) {
        next(err);
    }
};

// POST /auth/refresh-token
// summary: トークンリフレッシュ
// page: middleware
export const authPostRefreshTokenController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const refreshTokenQuery = req.cookies?.refreshToken || req.body?.refreshToken;

        if (!refreshTokenQuery) throw new AppError("INVALID_REFRESH_TOKEN", 401);

        const { accessToken, refreshToken, exp } = await refreshTokenUseCase({ refreshToken: refreshTokenQuery });

        res.status(200).json({
            accessToken,
            refreshToken,
            exp,
        });
    } catch (err) {
        next(err);
    }
};

// POST /auth/rehash-password
// summary: パスワード再ハッシュ
// page:
export const authPostRehashPasswordController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const body = req.validatedBody as EmailPasswordBody;

        const email = body.email;
        const plainPassword = body.password;

        await rehashPasswordUseCase({ email, plainPassword });

        res.status(200).json({ message: "パスワードをハッシュ化して保存しました！" });
    } catch (err) {
        next(err);
    }
};

// PATCH /auth/email
// summary: メールアドレス変更リクエスト
// page: /edit/email
export const authPatchEmailController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const body = req.validatedBody as EmailBody;

        await changeEmailUseCase({ userId, newEmail: body.email });

        res.status(200).json({
            message: "新しいメールアドレスにメールを送信しました。メールアドレスの変更はまだ完了しておりません。",
        });
    } catch (err) {
        next(err);
    }
};

// PATCH /auth/new-email?token=""
// summary: メールアドレス更新
// page: /edit/email/new-email
export const authPatchNewEmailController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const query = req.validatedQuery as NewEmailTokenQuery;

        await changeNewEmailUseCase({ token: query.token });

        res.status(200).json({ message: "メールアドレスを更新しました。" });
    } catch (err) {
        next(err);
    }
};

// GET /auth/status
// summary: ログインステータス取得
// page:
export const authGetStatusController = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ message: "トークン有効", loggedIn: true, user: req.user });
};
