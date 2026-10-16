import type { NextFunction, Request, Response } from "express-serve-static-core";
import { editNameUseCase } from "../../usecases/name/editName.js";
import { NameBody } from "../../validators/body/name.js";

// PATCH /name/:id
// summary: 氏名変更
// page: /edit/name
export const namePatchByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const nameId = Number(req.params.id);
        const userId = req.user!.id;

        const body = req.validatedBody as NameBody;
        const { sei, mei, seiKana, meiKana } = body;

        await editNameUseCase({ nameId, userId, sei, mei, seiKana, meiKana });

        res.status(200).json({ message: "氏名を更新しました。" });
    } catch (err) {
        next(err);
    }
};
