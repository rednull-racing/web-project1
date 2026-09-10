import { Router } from "express";
import {
    shopInfoGetByIdAddressController,
    shopInfoGetByIdBankAccountController,
    shopInfoGetByIdComFreeController,
    shopInfoGetByIdCompanyNameController,
    shopInfoGetByIdConNameController,
    shopInfoGetByIdOptionController,
    shopInfoGetByIdPhoneNumberController,
    shopInfoGetByIdRepNameController,
    shopInfoGetByIdSignup2Controller,
    shopInfoGetByIdSignup3Controller,
    shopInfoGetByIdSignup5Controller,
    shopInfoGetMyController,
    shopInfoPatchByIdOptionController,
    shopInfoPatchByIdPhoneNumberController,
    shopInfoPatchByIdRepNameController,
} from "../controllers/shopInfo.js";
import { authenticateToken } from "../middleware/index.js";
import {
    getShopAddressRateLimit,
    getShopBankAccountRateLimit,
    getShopComFreeRateLimit,
    getShopCompanyNameRateLimit,
    getShopConNameRateLimit,
    getShopMeRateLimit,
    getShopOptionRateLimit,
    getShopPhoneNumberRateLimit,
    getShopRepNameRateLimit,
    getShopSignup2RateLimit,
    getShopSignup3RateLimit,
    getShopSignup5RateLimit,
    shopOptionEditRateLimit,
    shopPhoneNumberEditRateLimit,
    shopRepNameEditRateLimit,
} from "../middleware/rateLimit/shopInfoRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { repNameBodySchema, shopOptionBodySchema } from "../validators/body/shopInfo.js";
import { phoneNumberBodySchema } from "../validators/body/users.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// PATCH /shop-info/:id/rep-name
// summary 代表者氏名変更
// page: /edit/name/shop/rep-name/signup/[id]
router.patch(
    "/:id/rep-name",
    authenticateToken,
    shopRepNameEditRateLimit,
    validateParams(idParamSchema),
    validateBody(repNameBodySchema),
    shopInfoPatchByIdRepNameController,
);

// PATCH /shop-info/:id/phone-number
// summary: 電話番号変更
// page: /edit/phone-number/shop/[id]
router.patch(
    "/:id/phone-number",
    authenticateToken,
    shopPhoneNumberEditRateLimit,
    validateParams(idParamSchema),
    validateBody(phoneNumberBodySchema),
    shopInfoPatchByIdPhoneNumberController,
);

// PATCH /shop-info/:id/option
// summary: オプション変更
// page: /edit/shop/option/[id]
router.patch(
    "/:id/option",
    authenticateToken,
    shopOptionEditRateLimit,
    validateParams(idParamSchema),
    validateBody(shopOptionBodySchema),
    shopInfoPatchByIdOptionController,
);

// GET /shop-info/my
// summary: ショップのidを取得
// page: /link/edit/shop
router.get("/my", getShopMeRateLimit, authenticateToken, shopInfoGetMyController);

// GET /shop-info/:id/address
// summary: 会社所在地取得
// page: /edit/address/shop/[id]・/edit/address/shop/signup/[id]
router.get(
    "/:id/address",
    getShopAddressRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoGetByIdAddressController,
);

// GET /shop-info/:id/bank-account
// summary: ショップ口座情報取得
// page: /edit/account/shop/[id]・/edit/account/shop/signup/[id]
router.get(
    "/:id/bank-account",
    getShopBankAccountRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoGetByIdBankAccountController,
);

// GET /shop-info/:id/rep-name
// summary: 代表者氏名取得
// page: /edit/name/shop/rep-name/[id]・/edit/name/shop/rep-name/signup/[id]
router.get(
    "/:id/rep-name",
    getShopRepNameRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoGetByIdRepNameController,
);

// GET /shop-info/:id/con-name
// summary: 担当者氏名取得
// page: /edit/name/shop/con-name/[id]・/edit/name/shop/con-name/signup/[id]
router.get(
    "/:id/con-name",
    getShopConNameRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoGetByIdConNameController,
);

// GET /shop-info/:id/phone-number
// summary: 電話番号取得
// page: /edit/phone-number/shop/[id]
router.get(
    "/:id/phone-number",
    getShopPhoneNumberRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoGetByIdPhoneNumberController,
);

// GET /shop-info/:id/company-name
// summary: 会社名取得
// page: /edit/shop/company-name/[id]
router.get(
    "/:id/company-name",
    getShopCompanyNameRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoGetByIdCompanyNameController,
);

// GET /shop-info/:id/option
// summary: オプション取得
// page: /edit/shop/option/[id]
router.get(
    "/:id/option",
    getShopOptionRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoGetByIdOptionController,
);

// GET /shop-info/:id/com-free
// summary: 事業形態取得
// page: /edit/shop/com-free/[id]
router.get(
    "/:id/com-free",
    getShopComFreeRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoGetByIdComFreeController,
);

// GET /shop-info/:id/signup/2
// summary: ショップ口座登録ページ インプット表示データ取得
// page: /shop-signup/step2/[id]
router.get(
    "/:id/signup/2",
    getShopSignup2RateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoGetByIdSignup2Controller,
);

// GET /shop-info/:id/signup/3
// summary: ショップ身分証登録ページ インプット表示データ取得
// page: /shop-signup/step3/[id]
router.get(
    "/:id/signup/3",
    getShopSignup3RateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoGetByIdSignup3Controller,
);

// GET /shop-info/:id/signup/5
// summary: ショップ登録確認ページデータ取得
// page: /shop-signup/step5/[id]
router.get(
    "/:id/signup/5",
    getShopSignup5RateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoGetByIdSignup5Controller,
);

export default router;
