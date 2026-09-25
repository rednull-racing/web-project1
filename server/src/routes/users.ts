import { Router } from "express";
import {
    getUserIdFileController,
    usersGetByIdProfileController,
    usersGetByIdProfileMetadataController,
    usersGetByIdStarController,
    usersGetCurrentPointsController,
    usersGetCurrentUriagekinController,
    usersGetHonninController,
    usersGetInquiryController,
    usersGetMeAdminController,
    usersGetMeController,
    usersGetMyaccountController,
    usersGetMyaddressController,
    usersGetMynameController,
    usersGetMyPageController,
    usersGetPhoneNumberController,
    usersGetProfileEditDataController,
    usersGetTransferPointsController,
    usersGetTransferRequestController,
    usersPatchHonninController,
    usersPatchPhoneNumberController,
    usersPatchProfileController,
} from "../controllers/users.js";
import { authenticateOptional, authenticateToken } from "../middleware/index.js";
import { parseMultipartBody } from "../middleware/multipart.js";
import {
    editPhoneNumberRateLimit,
    getAccountRateLimit,
    getAddressRateLimit,
    getHonninRateLimit,
    getInquiryRateLimit,
    getMyPageRateLimit,
    getNameRateLimit,
    getPhoneNumberRateLimit,
    getPointsRateLimit,
    getProfileEditRateLimit,
    getProfileMetadataRateLimit,
    getProfileRateLimit,
    getStarRateLimit,
    getTransferPointsRateLimit,
    getTransferRequestRateLimit,
    getUriagekinRateLimit,
    getUserIdFileRateLimit,
    profileEditRateLimit,
    requestHonninRateLimit,
} from "../middleware/rateLimit/usersRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { honninBodySchema, phoneNumberBodySchema, profileEditBodySchema } from "../validators/body/users.js";
import { idParamSchema } from "../validators/params/id.js";
import { userFilesIdParamSchema } from "../validators/params/user.js";
import { getProfileQuerySchema, profileEditQuerySchema } from "../validators/query/users.js";

const router = Router();

// PATCH /user/profile?imageEdit=boolean
// summary: プロフィール編集
// page: /edit/profile
router.patch(
    "/profile",
    authenticateToken,
    profileEditRateLimit,
    validateQuery(profileEditQuerySchema),
    validateBody(profileEditBodySchema),
    usersPatchProfileController,
);

// PATCH /user/phone-number
// summary: 電話番号変更
// page: /edit/phone-number
router.patch(
    "/phone-number",
    authenticateToken,
    editPhoneNumberRateLimit,
    validateBody(phoneNumberBodySchema),
    usersPatchPhoneNumberController,
);

// PATCH /user/honnin
// summary: 本人確認リクエスト
// page: /edit/honnin
router.patch(
    "/honnin",
    authenticateToken,
    requestHonninRateLimit,
    ...parseMultipartBody([
        { name: "frontIdCard", maxCount: 1 },
        { name: "rearIdCard", maxCount: 1 },
    ]),
    validateBody(honninBodySchema),
    usersPatchHonninController,
);

// GET /:id/profile?page=number&limit=number
// summary: プロフィール表示データ取得
// page: /profile/[id]
router.get(
    "/:id/profile",
    getProfileRateLimit,
    validateParams(idParamSchema),
    validateQuery(getProfileQuerySchema),
    usersGetByIdProfileController,
);

// GET /user/:id/star
// summary: スター数取得
// page: /profileなど
router.get("/:id/star", getStarRateLimit, validateParams(idParamSchema), usersGetByIdStarController);

// GET /user/:id/profile/metadata
// summary: プロフィールページ メタデータ
// page: /profile/[id]
router.get(
    "/:id/profile/metadata",
    getProfileMetadataRateLimit,
    validateParams(idParamSchema),
    usersGetByIdProfileMetadataController,
);

// GET /user/my-page
// summary: マイページ表示データ取得
// page: /my-page
router.get("/my-page", getMyPageRateLimit, authenticateToken, usersGetMyPageController);

// GET /user/inquiry
// summary: お問い合わせフォーム表示データ取得
// page: /inquiry
router.get("/inquiry", getInquiryRateLimit, authenticateToken, usersGetInquiryController);

// GET /user/phone-number
// summary: 電話番号取得
// page: /edit/phone-number
router.get("/phone-number", getPhoneNumberRateLimit, authenticateToken, usersGetPhoneNumberController);

// GET /user/profile-edit-data
// summary: プロフィール編集ページ表示データ取得
// page: /edit/profile
router.get("/profile-edit-data", getProfileEditRateLimit, authenticateToken, usersGetProfileEditDataController);

// GET /user/honnin
// summary: 本人確認フォーム表示データ取得
// page: /edit/honnin
router.get("/honnin", getHonninRateLimit, authenticateToken, usersGetHonninController);

// GET /user/transfer-points
// summary: ポイント変換ページ 表示データ取得
// page: /transfer/points
router.get("/transfer-points", getTransferPointsRateLimit, authenticateToken, usersGetTransferPointsController);

// GET /user/transfer-request
// summary: 振込申請ページ 表示データ取得
// page: /transfer/request
router.get("/transfer-request", getTransferRequestRateLimit, authenticateToken, usersGetTransferRequestController);

// GET /user/current-points
// summary: 現在の所有ポイント取得
// page: /history/points
router.get("/current-points", getPointsRateLimit, authenticateToken, usersGetCurrentPointsController);

// GET /user/current-uriagekin
// summary: 現在の所有売上金取得
// page: /history/uriagekin
router.get("/current-uriagekin", getUriagekinRateLimit, authenticateToken, usersGetCurrentUriagekinController);

// GET /user/myaddress
// summary: 住所取得
// page: /edit/address
router.get("/myaddress", getAddressRateLimit, authenticateToken, usersGetMyaddressController);

// GET /user/myaccount
// summary: 口座情報取得
// page: /edit/account
router.get("/myaccount", getAccountRateLimit, authenticateToken, usersGetMyaccountController);

// GET /user/myname
// summary: 自分の氏名取得
// page: /edit/nameなど
router.get("/myname", getNameRateLimit, authenticateToken, usersGetMynameController);

// GET /user/files/:s3MetadataId
// summary: 本人確認入力ページ 身分証画像取得
// page: /edit/honnin
router.get(
    "/file/:s3MetadataId",
    getUserIdFileRateLimit,
    authenticateToken,
    validateParams(userFilesIdParamSchema),
    getUserIdFileController,
);

// GET /user/me
router.get("/me", authenticateOptional, usersGetMeController);

// GET /user/me-admin
router.get("/me-admin", authenticateToken, usersGetMeAdminController);

export default router;
