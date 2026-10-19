import type { NextFunction, Request, Response } from "express-serve-static-core";
import { createItemDraftUseCase } from "../../usecases/itemDraft/createItemDraft.js";
import { deleteItemDraftUseCase } from "../../usecases/itemDraft/deleteItemDraft.js";
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

        const { videoSignedUrl, thumbnailSignedUrl, itemImageSignedUrls, attributesImageSignedUrls } =
            await createItemDraftUseCase({ userId, body });

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
