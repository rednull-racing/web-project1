import type { NextFunction, Request, Response } from "express-serve-static-core";
import { outputReferenceCodeUseCase } from "../../usecases/referenceCode/output.js";

// POST /reference-code/output
// summary: 紹介コード生成
// page: /my-page
export const referenceCodePostOutputController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;

        const output = await outputReferenceCodeUseCase({ userId });

        res.status(200).json({ output });
    } catch (err) {
        next(err);
    }
};
