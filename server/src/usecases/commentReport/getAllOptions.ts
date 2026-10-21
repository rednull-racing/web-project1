import { AppError } from "../../errors.js";
import type { CommentReportOption } from "../../models/comment_report_option.js";
import { getAllCommentReportOptions } from "../../services/commentReport/commentReport.js";

// GET /comment-report/all-options
// summary: CommentReportOptions取得
// page: /report/comment/[id]
export const getAllCommentReportOptionsUseCase = async (): Promise<CommentReportOption[]> => {
    const allOptions = await getAllCommentReportOptions();

    if (allOptions.length === 0) {
        throw new AppError("COMMENT_REPORT_OPTIONS_NOT_FOUND", 404);
    }

    return allOptions;
};
