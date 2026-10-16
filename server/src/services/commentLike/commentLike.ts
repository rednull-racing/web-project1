import { Op } from "sequelize";
import { CommentLike, ShopInfo, User } from "../../models/index.js";
import {
    CommentIdParams,
    CommentLikeWithUser,
    CommentUserParams,
    DeleteCommentLikeUserIdTransactionParams,
    DestroyParams,
    ListParams,
} from "../../types/serviceType/commentLike.js";

export const getCommentLikeOne = async ({ commentId, userId }: CommentUserParams) => {
    return CommentLike.findOne({
        where: {
            comment_id: commentId,
            user_id: userId,
        },
    });
};

export const getCommentLikeList = async ({ commentId, keyword }: ListParams) => {
    const userWhere = keyword ? { user_name: { [Op.iLike]: `%${String(keyword).trim()}%` } } : undefined;

    return CommentLike.findAll({
        attributes: ["id"],
        where: { comment_id: commentId },
        order: [["createdAt", "DESC"]],
        include: [
            {
                model: User,
                where: userWhere,
                required: !!keyword,
                attributes: ["id", "user_name", "profile_image", "honnin_verified", "early_seller"],
                include: [
                    {
                        model: ShopInfo,
                        attributes: ["id"],
                        required: false,
                    },
                ],
            },
        ],
    }) as unknown as CommentLikeWithUser[];
};

export const createCommentLike = async ({ commentId, userId }: CommentUserParams) => {
    return CommentLike.create({
        comment_id: commentId,
        user_id: userId,
    });
};

export const destroyCommentLike = async ({ data }: DestroyParams) => {
    await data.destroy();
};

export const deleteCommentLikeUserLogical = async ({
    userId,
    transaction,
}: DeleteCommentLikeUserIdTransactionParams) => {
    await CommentLike.destroy({
        where: { user_id: userId },
        transaction,
    });
};

export const countCommentLike = async ({ commentId }: CommentIdParams) => {
    return CommentLike.count({
        where: { comment_id: commentId },
    });
};
