import { Op } from "sequelize";
import { Follow, ShopInfo, User } from "../../models/index.js";
import type {
    CountParams,
    DeleteFollowUserIdTransactionParams,
    DestroyParams,
    FollowingsParams,
    FollowWithUser,
    ListParams,
    UserParams,
} from "../../types/serviceType/follow.js";

export const getFollowings = async ({ currentUserId, targetUserIds }: FollowingsParams) => {
    return (await Follow.findAll({
        where: {
            follow_user_id: currentUserId,
            follower_user_id: targetUserIds,
        },
    })) as unknown as InstanceType<typeof Follow>[];
};

export const getFollowOne = async ({ currentUserId, targetUserId }: UserParams) => {
    return Follow.findOne({
        where: {
            follow_user_id: currentUserId,
            follower_user_id: targetUserId,
        },
    });
};

export const getFollowList = async ({ pageUserId, type, keyword }: ListParams): Promise<FollowWithUser[]> => {
    const where = type === "follow" ? { follow_user_id: pageUserId } : { follower_user_id: pageUserId };

    const as = type === "follow" ? "FollowerUser" : "FollowUser";

    const userWhere = keyword ? { user_name: { [Op.iLike]: `%${String(keyword).trim()}%` } } : undefined;

    return Follow.findAll({
        attributes: ["id"],
        where,
        order: [["createdAt", "DESC"]],
        include: [
            {
                model: User,
                as,
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
    }) as unknown as FollowWithUser[];
};

export const createFollow = async ({ currentUserId, targetUserId }: UserParams) => {
    return Follow.create({
        follow_user_id: currentUserId,
        follower_user_id: targetUserId,
    });
};

export const destroyFollow = async ({ follow }: DestroyParams) => {
    await follow.destroy();
};

export const deleteFollowUserLogical = async ({ userId, transaction }: DeleteFollowUserIdTransactionParams) => {
    await Follow.destroy({
        where: { follow_user_id: userId },
        transaction,
    });
};

export const deleteFollowerUserLogical = async ({ userId, transaction }: DeleteFollowUserIdTransactionParams) => {
    await Follow.destroy({
        where: { follower_user_id: userId },
        transaction,
    });
};

export const countFollowBoth = async ({ userId }: CountParams) => {
    const [followCount, followerCount] = await Promise.all([
        Follow.count({ where: { follow_user_id: userId } }),
        Follow.count({ where: { follower_user_id: userId } }),
    ]);

    return { followCount, followerCount };
};

export const countFollower = async ({ userId, transaction }: CountParams) => {
    return Follow.count({
        where: { follower_user_id: userId },
        ...(transaction ? { transaction } : {}),
    });
};
