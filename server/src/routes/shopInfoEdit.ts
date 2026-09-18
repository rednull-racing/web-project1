import { Router } from "express";
import {
    shopInfoEditGetByIdAddressController,
    shopInfoEditGetByIdBankAccountController,
    shopInfoEditGetByIdComFreeConfirmController,
    shopInfoEditGetByIdConNameController,
    shopInfoEditGetByIdRepNameController,
    shopInfoEditPatchByIdController,
    shopInfoEditPostByIdAddressController,
    shopInfoEditPostByIdBankAccountController,
    shopInfoEditPostByIdComFreeController,
    shopInfoEditPostByIdCompanyNameController,
    shopInfoEditPostByIdRepNameController,
    updateShopInfoEditIdImageController,
} from "../controllers/shopInfoEdit.js";
import { getShopEditFileController } from "../controllers/shopSignup.js";
import { authenticateToken } from "../middleware/index.js";
import { parseMultipartBody } from "../middleware/multipart.js";
import {
    getShopEditAddressRateLimit,
    getShopEditComFreeConfirmRateLimit,
    getShopEditConNameRateLimit,
    getShopEditFileRateLimit,
    getShopEditRepNameRateLimit,
    patchShopEditRateLimit,
    shopEditAddressEditRateLimit,
    shopEditBankEditRateLimit,
    shopEditComFreeRateLimit,
    shopEditCompanyNameRateLimit,
    shopEditIdUploadRateLimit,
    shopEditRepNameEditRateLimit,
} from "../middleware/rateLimit/shopInfoEditRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { addressBodySchema } from "../validators/body/address.js";
import { bankBodySchema } from "../validators/body/bankAccount.js";
import { repNameBodySchema } from "../validators/body/shopInfo.js";
import {
    comFreeIdBodySchema,
    createCompanyNameBodySchema,
    shopInfoEditIdImageBodySchema,
    shopInfoEditUpdateBodySchema,
} from "../validators/body/shopInfoEdit.js";
import { idParamSchema } from "../validators/params/id.js";
import { shopEditFilesIdParamSchema } from "../validators/params/shopInfoEdit.js";

const router = Router();

// POST /shop-info-edit/:id/address
// summary: 会社所在地変更リクエスト
// page: /edit/address/shop/[id]
router.post(
    "/:id/address",
    authenticateToken,
    shopEditAddressEditRateLimit,
    validateParams(idParamSchema),
    validateBody(addressBodySchema),
    shopInfoEditPostByIdAddressController,
);

// POST /shop-info-edit/:id/bank-account
// summary: 口座情報変更リクエスト
// page: /edit/account/shop/[id]
router.post(
    "/:id/bank-account",
    authenticateToken,
    shopEditBankEditRateLimit,
    validateParams(idParamSchema),
    validateBody(bankBodySchema),
    shopInfoEditPostByIdBankAccountController,
);

// POST /shop-info-edit/:id/rep-name
// summary: 代表者氏名データ作成
// page: /edit/name/shop/rep-name/[id]
router.post(
    "/:id/rep-name",
    authenticateToken,
    shopEditRepNameEditRateLimit,
    validateParams(idParamSchema),
    validateBody(repNameBodySchema),
    shopInfoEditPostByIdRepNameController,
);

// POST /shop-info-edit/:id/company-name
// summary: 会社名変更リクエスト
// page: /edit/shop/company-name/[id]
router.post(
    "/:id/company-name",
    authenticateToken,
    shopEditCompanyNameRateLimit,
    validateParams(idParamSchema),
    validateBody(createCompanyNameBodySchema),
    shopInfoEditPostByIdCompanyNameController,
);

// POST /shop-info-edit/:id/com-free
// summary: 事業形態変更リクエスト
// page: /edit/shop/com-free/[id]
router.post(
    "/:id/com-free",
    authenticateToken,
    shopEditComFreeRateLimit,
    validateParams(idParamSchema),
    validateBody(comFreeIdBodySchema),
    shopInfoEditPostByIdComFreeController,
);

// PATCH /shop-info-edit/:id
// summary: 事業形態変更確認ページ データ更新
// page: /edit/shop/com-free/confirm/[id]
router.patch(
    "/:id",
    authenticateToken,
    patchShopEditRateLimit,
    validateParams(idParamSchema),
    validateBody(shopInfoEditUpdateBodySchema),
    shopInfoEditPatchByIdController,
);

// PATCH /shop-info-edit/:id/id-image-upload
// summary: 事業者登録 代表者身分証アップロード
// page: edit/shop/com-free/upload/[id]
router.patch(
    "/:id/id-image-upload",
    authenticateToken,
    shopEditIdUploadRateLimit,
    validateParams(idParamSchema),
    ...parseMultipartBody([
        { name: "frontIdCard", maxCount: 1 },
        { name: "rearIdCard", maxCount: 1 },
        { name: "permitFiles", maxCount: 10 },
    ]),
    validateBody(shopInfoEditIdImageBodySchema),
    updateShopInfoEditIdImageController,
);

// GET /shop-info-edit/:id/address
// summary: shopEdit住所取得
// page: /edit/address/shop/com-free/[id]
router.get(
    "/:id/address",
    getShopEditAddressRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoEditGetByIdAddressController,
);

// GET /shop-info-edit/:id/bank-account
// summary: shopEdit口座情報取得
// page: /edit/account/shop/com-free/[id]
router.get(
    "/:id/bank-account",
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoEditGetByIdBankAccountController,
);

// GET /shop-info-edit/:id/rep-name
// summary: shopEdit代表者氏名取得
// page: /edit/name/shop/rep-name/com-free/[id]
router.get(
    "/:id/rep-name",
    getShopEditRepNameRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoEditGetByIdRepNameController,
);

// GET /shop-info-edit/:id/con-name
// summary: shopEdit担当者氏名取得
// page: /edit/name/shop/con-name/com-free/[id]
router.get(
    "/:id/con-name",
    getShopEditConNameRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoEditGetByIdConNameController,
);

// GET /shop-info-edit/:id/com-free-confirm
// summary: 事業形態変更確認ページデータ取得
// page: /edit/shop/com-free/confirm/[id]
router.get(
    "/:id/com-free-confirm",
    getShopEditComFreeConfirmRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    shopInfoEditGetByIdComFreeConfirmController,
);

// GET /shop-info-edit/:shopEditId/files/:s3MetadataId
// summary: 代表者氏名更新ページ 画像取得
// page: /edit/name/shop/rep-name/[id]
router.get(
    "/:shopEditId/files/:s3MetadataId",
    getShopEditFileRateLimit,
    authenticateToken,
    validateParams(shopEditFilesIdParamSchema),
    getShopEditFileController,
);

export default router;
