import { Router } from "express";
import {
    authPostLoginController,
    authPostSetCookieController,
    authPostClearCookieController,
    authPostSignupController,
    authPostResendVerificationCodeController,
    authPostSignupVerifyController,
    authPostRequestPasswordResetController,
    authPostResetPwController,
    authPatchChangePwController,
    authPostRefreshTokenController,
    authPostRehashPasswordController,
    authPatchEmailController,
    authPatchNewEmailController,
    authGetStatusController,
} from "../controllers/auth/auth.js";
import { authenticateToken } from "../middleware/index.js";
import {
    emailChangeRateLimit,
    emailChangeRequestRateLimit,
    loginRateLimit,
    pwChangeRateLimit,
    pwResetRateLimit,
    pwResetRequestRateLimit,
    resendVerifyCodeRateLimit,
    signupRateLimit,
    signupVerifyRateLimit,
} from "../middleware/rateLimit/authRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import {
    changePWBodySchema,
    emailBodySchema,
    emailPasswordBodySchema,
    loginBodySchema,
    resetPWBodySchema,
    setCookieBodySchema,
    signupVerifyBodySchema,
    verifyTokenBodySchema,
} from "../validators/body/auth.js";
import { newEmailTokenQuerySchema } from "../validators/query/auth.js";

const router = Router();

// POST /auth/login
// summary: ログイン
// page: /login
router.post("/login", loginRateLimit, validateBody(loginBodySchema), authPostLoginController);

// POST /auth/set-cookie
// summary: クッキーセット
// page: /my-page
router.post("/set-cookie", validateBody(setCookieBodySchema), authPostSetCookieController);

// POST /auth/clear-cookie
// summary: クッキー削除
// page: /my-page
router.post("/clear-cookie", authPostClearCookieController);

// POST /auth/signup
// summary: サインアップ
// page: /signup
router.post("/signup", signupRateLimit, validateBody(emailPasswordBodySchema), authPostSignupController);

// POST /auth/resend-verification-code
// summary: 認証コード再送信
// page: /signup/verify
router.post(
    "/resend-verification-code",
    resendVerifyCodeRateLimit,
    validateBody(verifyTokenBodySchema),
    authPostResendVerificationCodeController,
);

// POST /auth/signup-verify
// summary: サインアップコード認証
// page: /signup/verify
router.post(
    "/signup-verify",
    signupVerifyRateLimit,
    validateBody(signupVerifyBodySchema),
    authPostSignupVerifyController,
);

// POST /auth/request-password-reset
// summary: パスワードリセットリクエスト
// page: /login/reset-pw-mail
router.post(
    "/request-password-reset",
    pwResetRequestRateLimit,
    validateBody(emailBodySchema),
    authPostRequestPasswordResetController,
);

// POST /auth/reset-pw
// summary: パスワードリセット
// page: /login/new-pw
router.post("/reset-pw", pwResetRateLimit, validateBody(resetPWBodySchema), authPostResetPwController);

// PATCH /auth/change-pw
// summary: パスワード変更
// page: /edit/password
router.patch(
    "/change-pw",
    pwChangeRateLimit,
    authenticateToken,
    validateBody(changePWBodySchema),
    authPatchChangePwController,
);

// POST /auth/refresh-token
// summary: トークンリフレッシュ
// page: middleware
router.post("/refresh-token", authPostRefreshTokenController);

// POST /auth/rehash-password
// summary: パスワード再ハッシュ
// page:
router.post("/rehash-password", authPostRehashPasswordController);

// PATCH /auth/email
// summary: メールアドレス変更リクエスト
// page: /edit/email
router.patch(
    "/email",
    authenticateToken,
    emailChangeRequestRateLimit,
    validateBody(emailBodySchema),
    authPatchEmailController,
);

// PATCH /auth/new-email?token=""
// summary: メールアドレス更新
// page: /edit/email/new-email
router.patch("/new-email", emailChangeRateLimit, validateQuery(newEmailTokenQuerySchema), authPatchNewEmailController);

// GET /auth/status
// summary: ログインステータス取得
// page:
router.get("/status", authenticateToken, authGetStatusController);

export default router;
