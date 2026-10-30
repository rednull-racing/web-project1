import { getItemDraftPageMetadataUseCase } from "../../usecases/itemDraft/getItemDraftPageMetadata.js";
import { getItemDraftPageUseCase } from "../../usecases/itemDraft/getItemDraftPage.js";
import type { NextFunction, Request, Response } from "express-serve-static-core";
import { createItemDraftUseCase } from "../../usecases/itemDraft/createItemDraft.js";
import { deleteItemDraftUseCase } from "../../usecases/itemDraft/deleteItemDraft.js";
import { convertItemDraftVideoUseCase } from "../../usecases/itemDraft/convertItemDraftVideo.js";
import { runDetachedTask } from "../../utils/runDetachedTask.js";
import { CreateItemDraftBody } from "../../validators/body/itemDraft.js";
import type { z } from "zod";
import type { idParamSchema } from "../../validators/params/id.js";

// POST /item-draft
// summary: 下書き商品作成
// page: /upload/[id]
export const createItemDraftController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const body = req.validatedBody as CreateItemDraftBody;

        const { itemDraftId, videoSignedUrl, thumbnailSignedUrl, itemImageSignedUrls, attributesImageSignedUrls } =
            await createItemDraftUseCase({ userId, body });

        res.status(200).json({
            itemDraftId,
            videoSignedUrl,
            thumbnailSignedUrl,
            itemImageSignedUrls,
            attributesImageSignedUrls,
        });
    } catch (err) {
        next(err);
    }
};

// PATCH /item-draft/:id/convert
// summary: 下書き商品動画HLS変換
// page: /upload/[id]
export const convertItemDraftVideoController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id: itemDraftId } = req.validatedParams as z.infer<typeof idParamSchema>;
        runDetachedTask({
            taskName: "convertItemDraftVideo",
            target: { userId, itemDraftId },
            task: () => convertItemDraftVideoUseCase({ userId, itemDraftId }),
        });
        res.status(202).json({ message: "変換処理を受け付けました" });
    } catch (err) {
        next(err);
    }
};

// DELETE /item-draft/:id
// summary: 下書き商品削除
// page: /item/draft/[id]
export const deleteItemDraftController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id: itemDraftId } = req.validatedParams as z.infer<typeof idParamSchema>;

        await deleteItemDraftUseCase({ itemDraftId, userId });

        res.status(200).json({ message: "下書き商品を削除しました" });
    } catch (err) {
        next(err);
    }
};

// GET /item-draft/:id/item-page
// summary: 下書き商品ページ データ取得
// page: /item/draft/[id]
export const getItemDraftPageController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id: itemDraftId } = req.validatedParams as z.infer<typeof idParamSchema>;
        const itemDraft = await getItemDraftPageUseCase({ itemDraftId, userId });
        res.status(200).json({ itemDraft });
    } catch (err) {
        next(err);
    }
};

// GET /item-draft/:id/metadata
// summary: 下書き商品ページ メタデータ取得
// page: /item/draft/[id]
export const getItemDraftPageMetadataController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id: itemDraftId } = req.validatedParams as z.infer<typeof idParamSchema>;
        const itemDraft = await getItemDraftPageMetadataUseCase({ itemDraftId, userId });
        res.status(200).json({ itemDraft });
    } catch (err) {
        next(err);
    }
};
