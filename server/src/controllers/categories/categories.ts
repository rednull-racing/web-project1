import type { NextFunction, Request, Response } from "express-serve-static-core";
import { getLevel2UseCase } from "../../usecases/categories/getLevel2.js";

// GET /categories/:id/level2
// summary: カテゴリーlevel2取得
// page: /upload
export const categoriesGetByIdLevel2Controller = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const parentId = Number(req.params.id);

        const category2 = await getLevel2UseCase({ parentId });

        res.status(200).json({ category2 });
    } catch (err) {
        next(err);
    }
};
