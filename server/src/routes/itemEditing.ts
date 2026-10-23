import {
    convertItemEditingVideoController,
    createItemEditingCopyController,
    createItemEditingDraftController,
} from "../controllers/itemEditing/itemEditing.js";
import {
    convertItemEditingVideoRateLimit,
    createItemEditingCopyRateLimit,
    createItemEditingDraftRateLimit,
} from "../middleware/rateLimit/itemEditingRateLimit.js";
import { createItemEditingCopyBodySchema, createItemEditingDraftBodySchema } from "../validators/body/itemEditing.js";
import { Router } from "express";
import {
    createItemEditingController,
    updateItemEditingConfirmController,
} from "../controllers/itemEditing/itemEditing.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
    createItemEditingRateLimit,
    updateItemEditingConfirmRateLimit,
} from "../middleware/rateLimit/itemEditingRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { updateItemEditingConfirmBodySchema } from "../validators/body/itemEditing.js";
import { idParamSchema } from "../validators/params/id.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { createItemEditingCopyQuerySchema } from "../validators/query/itemEditing.js";

const router = Router();

// PATCH /item-editing/:id/convert
// summary: 編集セッション動画HLS変換
// page: /upload/[id]
router.patch(
    "/:id/convert",
    authenticateToken,
    convertItemEditingVideoRateLimit,
    validateParams(idParamSchema),
    convertItemEditingVideoController,
);

// POST /item-editing
// summary: 商品データ作成
// page: /upload/before
router.post("/", authenticateToken, createItemEditingRateLimit, createItemEditingController);

// PUT /item-editing/:id
// summary: 商品アップロード
// page: /upload/[id]
router.put(
    "/:id",
    authenticateToken,
    updateItemEditingConfirmRateLimit,
    validateParams(idParamSchema),
    validateBody(updateItemEditingConfirmBodySchema),
    updateItemEditingConfirmController,
);

// POST /item-editing/draft
// summary: 下書きから商品編集セッション作成
// page: /item/draft/[id]
router.post(
    "/draft",
    authenticateToken,
    createItemEditingDraftRateLimit,
    validateBody(createItemEditingDraftBodySchema),
    createItemEditingDraftController,
);

// POST /item-editing/copy
// summary: 販売中商品からitem_editingへのコピー
// page: /item/[id]
router.post(
    "/copy",
    authenticateToken,
    createItemEditingCopyRateLimit,
    validateQuery(createItemEditingCopyQuerySchema),
    validateBody(createItemEditingCopyBodySchema),
    createItemEditingCopyController,
);

export default router;
