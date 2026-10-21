import type { NextFunction, Request, Response } from "express-serve-static-core";
import { createCommentReportUseCase } from "../../usecases/commentReport/create.js";
import { getAllCommentReportOptionsUseCase } from "../../usecases/commentReport/getAllOptions.js";
import { OptionIdBody } from "../../validators/body/report.js";

// POST /comment-report/:id
// summary: comment報告作成
// page: /report/comment/[id]
export const commentReportPostByIdController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const commentId = Number(req.params.id);
        const userId = req.user!.id;

        const body = req.validatedBody as OptionIdBody;
        const optionId = body.selected;

        await createCommentReportUseCase({ commentId, userId, optionId });

        res.status(200).json({ message: "報告を作成しました" });
    } catch (err) {
        next(err);
    }
};

// GET /comment-report/all-options
// summary: CommentReportOptions取得
// page: /report/comment/[id]
export const commentReportGetAllOptionsController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const options = await getAllCommentReportOptionsUseCase();

        res.status(200).json({ options });
    } catch (err) {
        next(err);
    }
};
