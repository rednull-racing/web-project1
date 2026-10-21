import { Router } from "express";
import {
    commentPostByIdController,
    commentPatchByIdSortNumberAddController,
    commentPatchByIdSortNumberDecreaseController,
    commentDeleteByIdController,
    commentGetByIdController,
    commentGetByIdReplyController,
} from "../controllers/comment/comment.js";
import { authenticateOptional, authenticateToken } from "../middleware/index.js";
import {
    createCommentRateLimit,
    deleteCommentRateLimit,
    editSortCommentRateLimit,
    getCommentListRateLimit,
    getReplyListRateLimit,
} from "../middleware/rateLimit/commentRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { createCommentBodySchema } from "../validators/body/comment.js";
import { idParamSchema } from "../validators/params/id.js";
import {
    commentSellerMeAdminQuerySchema,
    commentSortNumberQuerySchema,
    createCommentQuerySchema,
} from "../validators/query/comment.js";

const router = Router();

// POST /comment/:id?sellerMe=boolean(&parentId=number)
// summary: コメント作成
// page: /item
router.post(
    "/:id",
    validateParams(idParamSchema),
    validateQuery(createCommentQuerySchema),
    validateBody(createCommentBodySchema),
    authenticateToken,
    createCommentRateLimit,
    commentPostByIdController,
);

// PATCH /comment/:id/sort-number/add?number=number
// summary: sort_number追加
// page: /item
router.patch(
    "/:id/sort-number/add",
    editSortCommentRateLimit,
    validateParams(idParamSchema),
    validateQuery(commentSortNumberQuerySchema),
    commentPatchByIdSortNumberAddController,
);

// PATCH /comment/:id/sort-number/decrease?number=number
// summary: sort_number減少
// page: /item
router.patch(
    "/:id/sort-number/decrease",
    editSortCommentRateLimit,
    validateParams(idParamSchema),
    validateQuery(commentSortNumberQuerySchema),
    commentPatchByIdSortNumberDecreaseController,
);

// DELETE /comment/:id?page=""
// summary: コメント削除
// page: /item・/item/admin
router.delete(
    "/:id",
    validateParams(idParamSchema),
    authenticateToken,
    deleteCommentRateLimit,
    commentDeleteByIdController,
);

// GET /comment/:id?sellerMe=boolean(&admin=boolean)
// summary: コメント一覧取得
// page: /item
router.get(
    "/:id",
    getCommentListRateLimit,
    validateParams(idParamSchema),
    validateQuery(commentSellerMeAdminQuerySchema),
    authenticateOptional,
    commentGetByIdController,
);

// GET /comment/:id/reply?sellerMe=boolean(&admin=boolean)
// summary: 返信リスト取得
// page: /item
router.get(
    "/:id/reply",
    getReplyListRateLimit,
    validateParams(idParamSchema),
    validateQuery(commentSellerMeAdminQuerySchema),
    authenticateOptional,
    commentGetByIdReplyController,
);

export default router;
