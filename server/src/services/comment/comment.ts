import { Op } from "sequelize";
import { Comment, User } from "../../models/index.js";
import {
    CommentIdParams,
    CommentUserIdParams,
    CreateCommentParams,
    DeleteCommentUserIdTransactionParams,
    DestroyAllParams,
    DestroyParams,
    GetCommentsSortDecayCronParams,
    GetCommentsReportScoreCronParams,
    ItemIdParams,
    UpdateParams,
    UpdateReportScoreParams,
} from "../../types/serviceType/comment.js";

export const getCommentsReportScoreCron = ({ minReportScore }: GetCommentsReportScoreCronParams) => {
    return Comment.findAll({
        where: {
            report_score: { [Op.gt]: minReportScore },
        },
    });
};

export const getComment = ({ commentId }: CommentIdParams) => {
    return Comment.findByPk(commentId);
};

export const getMyComment = ({ commentId, userId }: CommentUserIdParams) => {
    return Comment.findOne({
        where: {
            id: commentId,
            user_id: userId,
        },
    });
};

export const getAllComments = ({ itemId }: ItemIdParams) => {
    return Comment.findAll({
        where: { item_id: itemId },
        limit: 100,
    });
};

export const getAllCommentsItemPage = ({ itemId }: ItemIdParams) => {
    return Comment.findAll({
        where: {
            item_id: itemId,
            parent_comment_id: null,
        },
        order: [
            ["pin", "DESC"],
            ["sort_number", "DESC"],
            ["createdAt", "DESC"],
        ],
        include: [
            {
                model: User,
                attributes: ["id", "user_name", "profile_image"],
            },
        ],
    });
};

export const getAllReply = ({ commentId }: CommentIdParams) => {
    return Comment.findAll({
        where: { parent_comment_id: commentId },
        order: [
            ["sort_number", "DESC"],
            ["createdAt", "DESC"],
        ],
        include: [
            {
                model: User,
                attributes: ["id", "user_name", "profile_image"],
            },
        ],
    });
};

export const getCommentsSortDecayCron = ({ minSortNumber }: GetCommentsSortDecayCronParams) => {
    return Comment.findAll({
        where: {
            sort_number: { [Op.gt]: minSortNumber },
        },
    });
};

export const updateSortNumber = async ({ comment, data }: UpdateParams) => {
    await comment.update(data);
};

export const updateReportScore = async ({ comment, data, transaction }: UpdateReportScoreParams) => {
    await comment.update(data, { transaction });
};

export const createComment = ({ data }: CreateCommentParams) => {
    return Comment.create(data);
};

export const destroyComment = async ({ comment }: DestroyParams) => {
    await comment.destroy();
};

export const destroyAllComments = async ({ comments, transaction }: DestroyAllParams) => {
    await Promise.all(
        comments.map(async (comment: InstanceType<typeof Comment>) => {
            await comment.destroy({ transaction });
        }),
    );
};

export const deleteCommentUserLogical = async ({ userId, transaction }: DeleteCommentUserIdTransactionParams) => {
    await Comment.destroy({
        where: { user_id: userId },
        transaction,
    });
};

export const countItemPageComment = ({ itemId }: ItemIdParams) => {
    return Comment.count({
        where: { item_id: itemId },
    });
};

export const countReply = async ({ commentId }: CommentIdParams) => {
    return Comment.count({
        where: { parent_comment_id: commentId },
    });
};
