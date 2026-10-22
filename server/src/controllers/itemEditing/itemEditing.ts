import type { NextFunction, Request, Response } from "express-serve-static-core";
import { convertItemEditingVideoUseCase } from "../../usecases/itemEditing/convertItemEditingVideo.js";
import { runDetachedTask } from "../../utils/runDetachedTask.js";
import { createItemEditingUseCase } from "../../usecases/itemEditing/createItemEditing.js";
import { createItemEditingCopyUseCase } from "../../usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.js";
import { createItemEditingDraftUseCase } from "../../usecases/itemEditing/createItemEditingDraft.js";
import { updateItemEditingConfirmUseCase } from "../../usecases/itemEditing/updateConfirm.js";
import type { CreateItemEditingCopyBody, CreateItemEditingDraftBody } from "../../validators/body/itemEditing.js";
import { ItemEditingConfirmBody } from "../../validators/body/itemEditing.js";

// PATCH /item-editing/:id/convert
// summary: 編集セッション動画HLS変換
// page: /upload/[id]
export const convertItemEditingVideoController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { id: itemEditingId } = req.validatedParams as { id: number };

        runDetachedTask({
            taskName: "convertItemEditingVideo",
            target: { userId, itemEditingId },
            task: () => convertItemEditingVideoUseCase({ userId, itemEditingId }),
        });

        res.status(202).json({ message: "変換処理を受け付けました" });
    } catch (err) {
        next(err);
    }
};

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
