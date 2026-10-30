import { Router } from "express";
import {
    getItemDraftPageController,
    getItemDraftPageMetadataController,
    convertItemDraftVideoController,
    createItemDraftController,
    deleteItemDraftController,
} from "../controllers/itemDraft/itemDraft.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
    getItemDraftPageRateLimit,
    getItemDraftPageMetadataRateLimit,
    convertItemDraftVideoRateLimit,
    createItemDraftRateLimit,
    deleteItemDraftRateLimit,
} from "../middleware/rateLimit/itemDraftRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { createItemDraftBodySchema } from "../validators/body/itemDraft.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// PATCH /item-draft/:id/convert
// summary: 下書き商品動画HLS変換
// page: /upload/[id]
router.patch(
    "/:id/convert",
    authenticateToken,
    convertItemDraftVideoRateLimit,
    validateParams(idParamSchema),
    convertItemDraftVideoController,
);

// POST /item-draft
// summary: 下書き商品作成
// page: /upload/[id]
router.post(
    "/",
    authenticateToken,
    createItemDraftRateLimit,
    validateBody(createItemDraftBodySchema),
    createItemDraftController,
);

// DELETE /item-draft/:id
// summary: 下書き商品削除
// page: /item/draft/[id]
router.delete(
    "/:id",
    authenticateToken,
    deleteItemDraftRateLimit,
    validateParams(idParamSchema),
    deleteItemDraftController,
);

// GET /item-draft/:id/item-page
// summary: 下書き商品ページ データ取得
// page: /item/draft/[id]
router.get(
    "/:id/item-page",
    authenticateToken,
    getItemDraftPageRateLimit,
    validateParams(idParamSchema),
    getItemDraftPageController,
);

// GET /item-draft/:id/metadata
// summary: 下書き商品ページ メタデータ取得
// page: /item/draft/[id]
router.get(
    "/:id/metadata",
    authenticateToken,
    getItemDraftPageMetadataRateLimit,
    validateParams(idParamSchema),
    getItemDraftPageMetadataController,
);

export default router;
