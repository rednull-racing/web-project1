import type { NextFunction, Request, Response } from "express-serve-static-core";
import { createItemEditingUseCase } from "../usecases/itemEditing/createItemEditing.js";
import { createItemEditingDraftUseCase } from "../usecases/itemEditing/createItemEditingDraft.js";
import { createItemEditingCopyUseCase } from "../usecases/itemEditing/createItemEditingCopy.js";
import { updateItemEditingConfirmUseCase } from "../usecases/itemEditing/updateConfirm.js";
import type { CreateItemEditingCopyBody, CreateItemEditingDraftBody } from "../validators/body/itemEditing.js";
import { ItemEditingConfirmBody } from "../validators/body/itemEditing.js";

// POST /item-editing
// summary: 商品データ作成
// page: /upload/before
export const createItemEditingController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const itemEditingId = await createItemEditingUseCase({ userId });

        res.status(200).json({ itemEditingId });
    } catch (err) {
        next(err);
    }
};

// PUT /item-editing/:id
// summary: 商品アップロード
// page: /upload/[id]
export const updateItemEditingConfirmController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const itemEditingId = Number(req.params.id);
        const userId = req.user!.id;

        const body = req.validatedBody as ItemEditingConfirmBody;

        const { videoSignedUrl, thumbnailSignedUrl, itemImageSignedUrls, attributesImageSignedUrls } =
            await updateItemEditingConfirmUseCase({ itemEditingId, userId, body });

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

// POST /item-editing/draft
// summary: 下書きから商品編集セッション作成
// page: /item/draft/[id]
export const createItemEditingDraftController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;

        const { itemDraftId } = req.validatedBody as CreateItemEditingDraftBody;

        const itemEditingId = await createItemEditingDraftUseCase({ userId, itemDraftId });

        res.status(201).json({ itemEditingId });
    } catch (err) {
        next(err);
    }
};

// POST /item-editing/copy
// summary: 販売中商品からitem_editingへのコピー
// page: /item/[id]
export const createItemEditingCopyController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { itemId } = req.validatedBody as CreateItemEditingCopyBody;

        const itemEditingId = await createItemEditingCopyUseCase({ userId, itemId });

        res.status(201).json({ itemEditingId });
    } catch (err) {
        next(err);
    }
};
