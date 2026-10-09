import type { NextFunction, Request, Response } from "express-serve-static-core";
import { uploadMainUseCase } from "../usecases/itemEditing/updateConfirm.js";
import { deleteDraftItemUseCase } from "../usecases/items/delete/draftDelete.js";
import { deleteItemLogicallyUseCase } from "../usecases/items/delete/logicalDelete.js";
import { deleteItemPerfectUseCase } from "../usecases/items/delete/perfectDelete.js";
import { getFormDataUseCase } from "../usecases/items/formData/getFormData.js";
import { getItemHighlightUseCase } from "../usecases/items/highlight/getItemHighlight.js";
import { getItemListUseCase } from "../usecases/items/itemList/itemList.js";
import { getRecommendItemsUseCase } from "../usecases/items/itemList/recommendItems.js";
import { getItemPageUseCase } from "../usecases/items/itemPage/itemPage.js";
import { getMetadataUseCase } from "../usecases/items/itemPage/metadata.js";
import { patchItemLogsAccessUseCase } from "../usecases/items/log/accessLogs.js";
import { restoreItemUseCase } from "../usecases/items/restore/restore.js";
import { getSearchItemsUseCase } from "../usecases/items/search/getSearchItems.js";
import { patchSortNumberAddUseCase, patchSortNumberDecreaseUseCase } from "../usecases/items/sortNumber/sortNumber.js";
import { itemCopyUploadUseCase } from "../usecases/items/upload/copyUpload/copyUpload.js";
import { createItemsUseCase } from "../usecases/items/upload/createItem.js";
import { patchPublishUseCase } from "../usecases/items/upload/publish.js";
import { uploadDraftUseCase } from "../usecases/items/upload/uploadDraft.js";
import { runDetachedTask } from "../utils/runDetachedTask.js";
import type { ItemUploadBody } from "../validators/body/items.js";
import type {
    ItemListQuery,
    ItemPageQuery,
    ItemSortNumberQuery,
    ItemUploadQuery,
    RecommendItemsQuery,
    SearchItemsQuery,
} from "../validators/query/items.js";

// POST /items
// summary: 商品データ作成
// page: /upload/before
export const createItemController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const itemId = await createItemsUseCase({ userId });

        res.status(200).json({ itemId });
    } catch (err) {
        next(err);
    }
};

// POST /items/:id/copy-upload
// summary: 商品コピーアップロード
// page: /item/[id]
export const copyUploadItemController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        const newItemId = await itemCopyUploadUseCase({ itemId, userId });

        res.status(200).json({ newItemId });
    } catch (err) {
        next(err);
    }
};

// PUT /items/:id?mode=""
// summary: 商品アップロード
// page: /upload/[id]
export const uploadItemController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = parseInt(req.params.id);
        const userId = req.user!.id;

        const query = req.validatedQuery as ItemUploadQuery;

        const body = req.validatedBody as ItemUploadBody;

        const usecase = query.mode === "main" ? uploadMainUseCase : uploadDraftUseCase;

        const { videoSignedUrl, thumbnailSignedUrl, itemImageSignedUrls, attributesImageSignedUrls } = await usecase({
            itemId,
            userId,
            body,
        });

        res.status(200).json({
            videoSignedUrl,
            thumbnailSignedUrl,
            itemImageSignedUrls,
            attributesImageSignedUrls,
        });
    } catch (err) {
        next(err);
    }
};

// PATCH /items/:id/publish
// summary: 商品公開
// page: /item/confirm/[id]
export const publishItemController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        await patchPublishUseCase({ itemId, userId });

        res.status(200).json({ message: "出品成功！" });
    } catch (err) {
        next(err);
    }
};

// PATCH /items/:id/sort-number/add?number=number
// summary: sortNumber追加
// page: /itemなど
export const addItemSortNumberController = async (req: Request, res: Response): Promise<void> => {
    const itemId = Number(req.params.id);

    const query = req.validatedQuery as ItemSortNumberQuery;

    const number = query.number;

    runDetachedTask({
        taskName: "patchItemSortNumberAdd",
        target: { itemId },
        task: () => patchSortNumberAddUseCase({ itemId, number }),
    });

    res.status(202).json({ message: "sort_numberの更新を受け付けました" });
};

// PATCH /items/:id/sort-number/decrease?number=number
// summary: sortNumber減少
// page: /itemなど
export const decreaseItemSortNumberController = async (req: Request, res: Response): Promise<void> => {
    const itemId = Number(req.params.id);

    const query = req.validatedQuery as ItemSortNumberQuery;

    const number = query.number;

    runDetachedTask({
        taskName: "patchItemSortNumberDecrease",
        target: { itemId },
        task: () => patchSortNumberDecreaseUseCase({ itemId, number }),
    });

    res.status(202).json({ message: "sort_numberの更新を受け付けました" });
};

// PATCH /items/:id/logs/access
// summary: アクセスログ記録
// page: /item/[id]
export const patchItemAccessLogsController = async (req: Request, res: Response): Promise<void> => {
    const itemId = Number(req.params.id);
    const userId = req.user?.id ?? null;

    runDetachedTask({
        taskName: "patchItemAccessLogs",
        target: { itemId },
        task: () => patchItemLogsAccessUseCase({ itemId, userId }),
    });

    res.status(202).json({ message: "商品ページアクセス処理を受け付けました" });
};

// PATCH /items/:id/restore
// summary: 商品データ復元
// page: /item/deleted/[id]
export const restoreItemController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        await restoreItemUseCase({ userId, itemId });

        res.status(200).json({ message: "商品を復元しました" });
    } catch (err) {
        next(err);
    }
};

// DELETE /items/:id/logical
// summary: 商品論理削除
// page: /item/[id]
export const deleteItemLogicallyController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        await deleteItemLogicallyUseCase({ itemId, userId });

        res.status(200).json({ message: "商品を削除しました" });
    } catch (err) {
        next(err);
    }
};

// DELETE /items/:id/perfect
// summary: 商品完全削除
// page: /item/deleted/[id]
export const deleteItemPerfectController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        await deleteItemPerfectUseCase({ itemId, userId });

        res.status(200).json({ message: "商品削除が完了しました。" });
    } catch (err) {
        next(err);
    }
};

// DELETE /items/:id/draft
// summary: 下書き商品削除
// page: /item/draft/[id]
export const deleteDraftItemController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        await deleteDraftItemUseCase({ itemId, userId });

        res.status(200).json({ message: "下書き商品を削除しました" });
    } catch (err) {
        next(err);
    }
};

// GET /items?type=""&page=number&view=""&limit=number(&pageUserId=${id})
// summary: 商品リスト取得
// page: /lp・/profile
export const getItemListController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.id ?? null;

        const query = req.validatedQuery as ItemListQuery;

        const { items, totalPages } = await getItemListUseCase({ ...query, userId });

        res.status(200).json({ items, totalPages });
    } catch (err) {
        next(err);
    }
};

// GET /items/recommend?view=""(&itemId=number)
// summary: レコメンドリスト取得
// page: /item・/item-list/cart・/など
export const getRecommendItemsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.id ?? null;

        const query = req.validatedQuery as RecommendItemsQuery;

        const items = await getRecommendItemsUseCase({ ...query, userId });

        res.status(200).json({ items });
    } catch (err) {
        next(err);
    }
};

// GET /item/search?keyword=""&limit=number&sort=""(&cursorScore=number&cursorId=number)
// summary: キーワード検索
// page: /search?keyword=""
export const searchItemsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.id ?? undefined;

        const query = req.validatedQuery as SearchItemsQuery;

        const { keyword, limit, sort, cursorScore, cursorId } = query;

        const { itemList, nextCursorScore, nextCursorId, hasMore } = await getSearchItemsUseCase({
            keyword,
            limit,
            sort,
            cursorId,
            cursorScore,
            userId,
        });

        res.status(200).json({ itemList, nextCursorScore, nextCursorId, hasMore });
    } catch (err) {
        next(err);
    }
};

// GET /items/:id?mode=""
// summary: 商品ページ データ取得
// page: /item
export const getItemPageController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user?.id ?? null;

        const query = req.validatedQuery as ItemPageQuery;

        const mode = query.mode;

        const { item, sellerMe, likeCount, isLikeByMe, commentCount, me } = await getItemPageUseCase({
            itemId,
            userId,
            mode,
        });

        res.status(200).json({
            item,
            sellerMe,
            likeCount,
            isLikeByMe,
            commentCount,
            me,
        });
    } catch (err) {
        next(err);
    }
};

// GET /items/:id/metadata
// summary: 商品ページメタデータ
// page: /item
export const getItemMetadataController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const item = await getMetadataUseCase({ itemId });

        res.status(200).json({ item });
    } catch (err) {
        next(err);
    }
};

// GET /items/:id/form-data
// summary: アップロードフォーム表示データ取得
// page: /upload
export const getItemFormDataController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.user!.id;

        const { item, category, allCondition, allDay, allService, allPlace, hasShop } = await getFormDataUseCase({
            itemId,
            userId,
        });

        res.status(200).json({
            item,
            category,
            allCondition,
            hasShop,
            allDay,
            allService,
            allPlace,
        });
    } catch (err) {
        next(err);
    }
};

// GET /items/:id/highlight
// summary: 商品データ簡易表示
// page: /upload/ok
export const getItemHighlightController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const itemId = Number(req.params.id);

        const item = await getItemHighlightUseCase({ itemId });

        res.status(200).json({ item });
    } catch (err) {
        next(err);
    }
};
