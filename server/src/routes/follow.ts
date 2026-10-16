import { Router } from "express";
import {
    followPostByIdController,
    followDeleteByIdController,
    followGetByIdStatusController,
    followGetByIdCountController,
    followGetByIdUserController,
} from "../controllers/follow/follow.js";
import { authenticateOptional, authenticateToken } from "../middleware/index.js";
import {
    addFollowRateLimit,
    deleteFollowRateLimit,
    followCountRateLimit,
    followStatusRateLimit,
    followUserListRateLimit,
} from "../middleware/rateLimit/followRateLimit.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { idParamSchema } from "../validators/params/id.js";
import { followUserListQuerySchema } from "../validators/query/follow.js";

const router = Router();

// POST /follow/:id
// summary: フォロー作成
// page: フォローボタンがあるページ
router.post("/:id", addFollowRateLimit, validateParams(idParamSchema), authenticateToken, followPostByIdController);

// DELETE /follow/:id
// summary: フォロー削除
// page: フォローボタンがあるページ
router.delete(
    "/:id",
    deleteFollowRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    followDeleteByIdController,
);

// GET /follow/:id/status
// summary: フォローステータス取得
// page: フォローボタンがあるページ
router.get(
    "/:id/status",
    followStatusRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    followGetByIdStatusController,
);

// GET /follow/:id/count
// summary: フォロー・フォロワー数カウント取得
// page: フォロー・フォロワー数表示
router.get("/:id/count", followCountRateLimit, validateParams(idParamSchema), followGetByIdCountController);

// GET /follow/:id/user?type=""(&keyword="")
// summary: フォロー・フォロワーリスト取得
// page: /user-list/follow/[id]
router.get(
    "/:id/user",
    followUserListRateLimit,
    validateParams(idParamSchema),
    validateQuery(followUserListQuerySchema),
    authenticateOptional,
    followGetByIdUserController,
);

export default router;
