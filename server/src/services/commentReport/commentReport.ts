import { CommentReport, CommentReportOption } from "../../models/index.js";
import { CommentIdParams, CreateCommentReportParams, OptionIdParams } from "../../types/serviceType/commentReport.js";

export const countCommentReport = ({ commentId }: CommentIdParams) => {
    return CommentReport.count({
        where: { comment_id: commentId },
    });
};

export const createCommentReport = async ({ data }: CreateCommentReportParams) => {
    await CommentReport.create(data);
};

export const getCommentReportOption = ({ optionId }: OptionIdParams) => {
    return CommentReportOption.findByPk(optionId);
};

export const getAllCommentReportOptions = () => {
    return CommentReportOption.findAll();
};
