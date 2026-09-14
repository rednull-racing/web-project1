import { Router } from "express";
import {
    getShopSignup1Controller,
    getShopSignup2Controller,
    getShopSignup3Controller,
    getShopSignup5Controller,
    getShopSignupFileController,
    shopSignupPostRootController,
    updateShopSignup2Controller,
    updateShopSignup3Controller,
    updateShopSignup5Controller,
    updateShopSignupEditController,
    updateShopSignupOptionController,
} from "../controllers/shopSignup.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { parseMultipartBody } from "../middleware/multipart.js";
import {
    createShopSignupRateLimit,
    getShopSignup1RateLimit,
    getShopSignup2RateLimit,
    getShopSignup3RateLimit,
    getShopSignup5RateLimit,
    getShopSignupFileRateLimit,
    shopSignup4RateLimit,
    shopSignup5EditRateLimit,
    shopSignup5RateLimit,
    signup2RateLimit,
    signup3RateLimit,
} from "../middleware/rateLimit/shopSignup.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { bankBodySchema } from "../validators/body/bankAccount.js";
import {
    createSignup1BodySchema,
    shopSignup3BodySchema,
    shopSignupEditBodySchema,
    shopSignupOptionBodySchema,
} from "../validators/body/shopSignup.js";
import { idParamSchema } from "../validators/params/id.js";
import { shopSignupFilesIdParamSchema } from "../validators/params/shopSignup.js";

const router = Router();

// POST /shop-signup
// summary: ShopSignup作成 事業者登録
// page: /shop-signup/step1
router.post(
    "/",
    authenticateToken,
    createShopSignupRateLimit,
    validateBody(createSignup1BodySchema),
    shopSignupPostRootController,
);

// PATCH /shop-signup/:id/bank-account
// summary: ショップ口座情報作成
// page: /shop-signup/step2
router.patch(
    "/:id/bank-account",
    validateParams(idParamSchema),
    validateBody(bankBodySchema),
    authenticateToken,
    signup2RateLimit,
    updateShopSignup2Controller,
);

// PATCH /shop-signup/:id/id-card
// summary: ショップ登録身分証・許認可証追加
// page: /shop-signup/step3/[id]
router.patch(
    "/:id/id-card",
    validateParams(idParamSchema),
    ...parseMultipartBody([
        { name: "frontIdCard", maxCount: 1 },
        { name: "rearIdCard", maxCount: 1 },
        { name: "permitFiles", maxCount: 10 },
    ]),
    validateBody(shopSignup3BodySchema),
    authenticateToken,
    signup3RateLimit,
    updateShopSignup3Controller,
);

// PATCH /shop-signup/:id/option
// summary: ショップ登録オプション選択
// page: /shop-signup/step4/[id]
router.patch(
    "/:id/option",
    authenticateToken,
    shopSignup4RateLimit,
    validateParams(idParamSchema),
    validateBody(shopSignupOptionBodySchema),
    updateShopSignupOptionController,
);

// PATCH /shop-signup/:id/edit
// summary: ショップ登録確認ページ インプット編集
// page: /shop-signup/step5/[id]
router.patch(
    "/:id/edit",
    authenticateToken,
    shopSignup5EditRateLimit,
    validateParams(idParamSchema),
    validateBody(shopSignupEditBodySchema),
    updateShopSignupEditController,
);

// PATCH /shop-signup/:id/signup5
// summary: ショップ登録 確定
// page: /shop-signup/step5/[id]
router.patch(
    "/:id/signup5",
    authenticateToken,
    shopSignup5RateLimit,
    validateParams(idParamSchema),
    updateShopSignup5Controller,
);

// GET /shop-signup/1
// summary: 事業者情報登録ページ インプット表示データ取得
// page: /shop-signup/step1
router.get("/1", getShopSignup1RateLimit, authenticateToken, getShopSignup1Controller);

// GET /shop-signup/:id/2
// summary: ショップ口座登録ページ インプット表示データ取得
// page: /shop-signup/step2/[id]
router.get(
    "/:id/2",
    getShopSignup2RateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    getShopSignup2Controller,
);

// GET /shop-signup/:id/3
// summary: ショップ身分証アップロードページ メタデータ取得
// page: /shop-signup/step3/[id]
router.get(
    "/:id/3",
    getShopSignup3RateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    getShopSignup3Controller,
);

// GET /shop-signup/:shopSignupId/files/:s3MetadataId
// summary: ショップ身分証アップロードページ 画像取得
// page: /shop-signup/step3/[id]
router.get(
    "/:shopSignupId/files/:s3MetadataId",
    getShopSignupFileRateLimit,
    authenticateToken,
    validateParams(shopSignupFilesIdParamSchema),
    getShopSignupFileController,
);

// GET /shop-signup/:id/5
// summary: ショップ登録確認ページデータ取得
// page: /shop-signup/step5/[id]
router.get(
    "/:id/5",
    getShopSignup5RateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    getShopSignup5Controller,
);

export default router;
