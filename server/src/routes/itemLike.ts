import { Router } from "express";
import {
    getItemLikeListController,
    itemLikePostByIdController,
    itemLikeDeleteByIdController,
    itemLikeGetByIdStatusController,
    itemLikeGetByIdCountController,
    itemLikeGetByIdUserController,
} from "../controllers/itemLike/itemLike.js";
import { authenticateToken } from "../middleware/index.js";
import {
    getItemLikeListRateLimit,
    addItemLikeRateLimit,
    deleteItemLikeRateLimit,
    itemLikeCountRateLimit,
    itemLikeStatusRateLimit,
    itemLikeUserListRateLimit,
} from "../middleware/rateLimit/itemLikeRateLimit.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { idParamSchema } from "../validators/params/id.js";
import { keywordOptionalQuerySchema } from "../validators/query/keyword.js";

import { getItemLikeListQuerySchema } from "../validators/query/itemLike.js";

const router = Router();

// GET /item-like/item-list?page=number&status=""&keyword=""
// summary: いいねした商品リスト取得
// page: /item-list/like
router.get(
    "/item-list",
    authenticateToken,
    getItemLikeListRateLimit,
    validateQuery(getItemLikeListQuerySchema),
    getItemLikeListController,
);

// POST /item-like/:id
// summary: いいね作成
// page: /item
router.post("/:id", addItemLikeRateLimit, validateParams(idParamSchema), authenticateToken, itemLikePostByIdController);

// DELETE /item-like/:id
// summary: いいね削除
// page: /item
router.delete(
    "/:id",
    deleteItemLikeRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    itemLikeDeleteByIdController,
);

// GET /item-like/:id/status
// summary: いいねステータス取得
// page: /item
router.get(
    "/:id/status",
    itemLikeStatusRateLimit,
    validateParams(idParamSchema),
    authenticateToken,
    itemLikeGetByIdStatusController,
);

// GET /item-like/:id/count
// summary: いいね数取得
// page: /item
router.get("/:id/count", itemLikeCountRateLimit, validateParams(idParamSchema), itemLikeGetByIdCountController);

// GET /item-like/:id/user(?keyword="")
// summary: いいねしたユーザーリスト取得
// page: /user-list/item-like/[id]
router.get(
    "/:id/user",
    itemLikeUserListRateLimit,
    validateParams(idParamSchema),
    validateQuery(keywordOptionalQuerySchema),
    authenticateToken,
    itemLikeGetByIdUserController,
);

export default router;
