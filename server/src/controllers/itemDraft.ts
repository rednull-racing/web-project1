import type { NextFunction, Request, Response } from "express-serve-static-core";
import { createItemDraftUseCase } from "../usecases/itemDraft/createItemDraft.js";
import { CreateItemDraftBody } from "../validators/body/itemDraft.js";

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
