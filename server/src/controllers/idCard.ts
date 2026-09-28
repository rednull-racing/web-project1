import type { NextFunction, Request, Response } from "express-serve-static-core";
import { UpdateIdCardBody } from "../validators/body/idCard.js";
import { updateIdCardUseCase } from "../usecases/idCard/updateIdCard.js";

// PATCH /id-card/:id
// summary: 身分証データ更新
// page: /edit/id-card
export const updateIdCardController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const idCardId = Number(req.params.id);
        const userId = req.user!.id;
        const body = req.validatedBody as UpdateIdCardBody;

        await updateIdCardUseCase({ idCardId, userId, body });

        res.status(200).json({ message: "電話番号を更新しました。" });
    } catch (err) {
        next(err);
    }
};