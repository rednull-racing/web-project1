import { Router } from "express";
import {
    commentLikePostByIdController,
    commentLikeDeleteByIdController,
    commentLikeGetByIdStatusController,
    commentLikeGetByIdCountController,
    commentLikeGetByIdUserController,
} from "../controllers/commentLike/commentLike.js";
import { authenticateToken } from "../middleware/index.js";
import {
    addCommentLikeRateLimit,
    commentLikeCountRateLimit,
    commentLikeStatusRateLimit,
    commentLikeUserListRateLimit,
    deleteCommentLikeRateLimit,
} from "../middleware/rateLimit/commentLikeRateLimit.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { idParamSchema } from "../validators/params/id.js";
import { keywordOptionalQuerySchema } from "../validators/query/keyword.js";

const router = Router();

// POST /comment-like/:id
// summary: いいね作成
// page: /item
router.post(
    "/:id",
    addCommentLikeRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    commentLikePostByIdController,
);

// DELETE /comment-like/:id
// summary: いいね削除
// page: /item
router.delete(
    "/:id",
    deleteCommentLikeRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    commentLikeDeleteByIdController,
);

// GET /comment-like/:id/status
// summary: いいねステータス取得
// page: /item
router.get(
    "/:id/status",
    commentLikeStatusRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    commentLikeGetByIdStatusController,
);

// GET /comment-like/:id/count
// summary: いいね数取得
// page: /item
router.get("/:id/count", commentLikeCountRateLimit, validateParams(idParamSchema), commentLikeGetByIdCountController);

// GET /comment-like/:id/user(?keyword="")
// summary: いいねしたユーザーリスト取得
// page: /user-list/comment-like/[id]
router.get(
    "/:id/user",
    commentLikeUserListRateLimit,
    validateParams(idParamSchema),
    validateQuery(keywordOptionalQuerySchema),
    authenticateToken,
    commentLikeGetByIdUserController,
);

export default router;
