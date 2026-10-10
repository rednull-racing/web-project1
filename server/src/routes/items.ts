import { Router } from "express";
import {
    addItemSortNumberController,
    copyUploadItemController,
    createItemController,
    decreaseItemSortNumberController,
    deleteDraftItemController,
    deleteItemLogicallyController,
    deleteItemPerfectController,
    getItemFormDataController,
    getItemHighlightController,
    getItemListController,
    getItemMetadataController,
    getItemPageController,
    getRecommendItemsController,
    patchItemAccessLogsController,
    publishItemController,
    restoreItemController,
    searchItemsController,
} from "../controllers/items.js";
import { authenticateOptional, authenticateToken } from "../middleware/index.js";
import {
    createItemCopyRateLimit,
    createItemRateLimit,
    draftDeleteItemRateLimit,
    editSortItemRateLimit,
    getItemHighlightRateLimit,
    getItemListRateLimit,
    getItemPageRateLimit,
    getItemRecommendRateLimit,
    getItemSearchRateLimit,
    getItemUploadFormDataRateLimit,
    logicalDeleteItemRateLimit,
    perfectDeleteItemRateLimit,
    restoreItemRateLimit,
    uploadPublishItemRateLimit,
} from "../middleware/rateLimit/itemsRateLimit.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { idParamSchema } from "../validators/params/id.js";
import {
    getItemPageQuerySchema,
    itemListQuerySchema,
    itemSortNumberQuerySchema,
    recommendItemsQuerySchema,
    searchItemsQuerySchema,
} from "../validators/query/items.js";

const router = Router();

// POST /items
// summary: 商品データ作成
// page: /upload/before
router.post("/", authenticateToken, createItemRateLimit, createItemController);

// POST /items/:id/copy-upload
// summary: 商品コピーアップロード
// page: /item/[id]
router.post(
    "/:id/copy-upload",
    authenticateToken,
    createItemCopyRateLimit,
    validateParams(idParamSchema),
    copyUploadItemController,
);

// PATCH /items/:id/publish
// summary: 商品公開
// page: /item/confirm/[id]
router.patch(
    "/:id/publish",
    authenticateToken,
    uploadPublishItemRateLimit,
    validateParams(idParamSchema),
    publishItemController,
);

// PATCH /items/:id/sort-number/add?number=number
// summary: sortNumber追加
// page: /itemなど
router.patch(
    "/:id/sort-number/add",
    editSortItemRateLimit,
    validateParams(idParamSchema),
    validateQuery(itemSortNumberQuerySchema),
    addItemSortNumberController,
);

// PATCH /items/:id/sort-number/decrease?number=number
// summary: sortNumber減少
// page: /itemなど
router.patch(
    "/:id/sort-number/decrease",
    editSortItemRateLimit,
    validateParams(idParamSchema),
    validateQuery(itemSortNumberQuerySchema),
    decreaseItemSortNumberController,
);

// PATCH /items/:id/logs/access
// summary: アクセスログ記録
// page: /item/[id]
router.patch("/:id/logs/access", authenticateOptional, validateParams(idParamSchema), patchItemAccessLogsController);

// PATCH /items/:id/restore
// summary: 商品データ復元
// page: /item/deleted/[id]
router.patch(
    "/:id/restore",
    authenticateToken,
    restoreItemRateLimit,
    validateParams(idParamSchema),
    restoreItemController,
);

// DELETE /items/:id/logical
// summary: 商品論理削除
// page: /item/[id]
router.delete(
    "/:id/logical",
    authenticateToken,
    logicalDeleteItemRateLimit,
    validateParams(idParamSchema),
    deleteItemLogicallyController,
);

// DELETE /items/:id/perfect
// summary: 商品完全削除
// page: /item/deleted/[id]
router.delete(
    "/:id/perfect",
    perfectDeleteItemRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    deleteItemPerfectController,
);

// DELETE /items/:id/draft
// summary: 下書き商品削除
// page: /item/draft/[id]
router.delete(
    "/:id/draft",
    authenticateToken,
    draftDeleteItemRateLimit,
    validateParams(idParamSchema),
    deleteDraftItemController,
);

// GET /items?type=""&page=number&view=""&limit=number(&pageUserId=${id})
// summary: 商品リスト取得
// page: /lp・/profile
router.get("/", getItemListRateLimit, authenticateOptional, validateQuery(itemListQuerySchema), getItemListController);

// GET /items/recommend?view=""(&itemId=number)
// summary: レコメンドリスト取得
// page: /item・/item-list/cart・/など
router.get(
    "/recommend",
    getItemRecommendRateLimit,
    authenticateOptional,
    validateQuery(recommendItemsQuerySchema),
    getRecommendItemsController,
);

// GET /item/search?keyword=""&limit=number&sort=""(&cursorScore=number&cursorId=number)
// summary: キーワード検索
// page: /search?keyword=""
router.get(
    "/search",
    getItemSearchRateLimit,
    authenticateOptional,
    validateQuery(searchItemsQuerySchema),
    searchItemsController,
);

// GET /items/:id?mode=""
// summary: 商品ページ データ取得
// page: /item
router.get(
    "/:id",
    getItemPageRateLimit,
    authenticateOptional,
    validateParams(idParamSchema),
    validateQuery(getItemPageQuerySchema),
    getItemPageController,
);

// GET /items/:id/metadata
// summary: 商品ページメタデータ
// page: /item
router.get("/:id/metadata", validateParams(idParamSchema), getItemMetadataController);

// GET /items/:id/form-data
// summary: アップロードフォーム表示データ取得
// page: /upload
router.get(
    "/:id/form-data",
    getItemUploadFormDataRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    getItemFormDataController,
);

// GET /items/:id/highlight
// summary: 商品データ簡易表示
// page: /upload/ok
router.get("/:id/highlight", getItemHighlightRateLimit, validateParams(idParamSchema), getItemHighlightController);

export default router;
