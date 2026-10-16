import { Op } from "sequelize";
import { Item, ItemLike, Sale, ShopInfo, User, Video } from "../../models/index.js";
import {
    DeleteItemLikeUserIdTransactionParams,
    DestroyParams,
    DestroyTransactionParams,
    ItemIdParams,
    ItemLikeWithUser,
    ItemUserParams,
    ListParams,
    UserItemsLikesParams,
} from "../../types/serviceType/itemLike.js";

export const getItemLikeOne = async ({ itemId, userId }: ItemUserParams) => {
    return ItemLike.findOne({
        where: {
            item_id: itemId,
            user_id: userId,
        },
    });
};

export const getAllItemLikes = async ({ itemId }: ItemIdParams) => {
    return ItemLike.findAll({
        where: { item_id: itemId },
    });
};

export const getItemLikeList = async ({ itemId, keyword }: ListParams) => {
    const userWhere = keyword ? { user_name: { [Op.iLike]: `%${String(keyword).trim()}%` } } : undefined;

    return ItemLike.findAll({
        attributes: ["id"],
        where: { item_id: itemId },
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
    }) as unknown as ItemLikeWithUser[];
};

export const getUserItemsLikesList = async ({ itemWhere, limit, offset, userId }: UserItemsLikesParams) => {
    const likeList = await ItemLike.findAll({
        attributes: ["id"],
        where: { user_id: userId },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
        include: [
            {
                model: Item,
                where: itemWhere,
                attributes: [
                    "id",
                    "name",
                    "price",
                    "status",
                    "seller_id",
                    "first_image_url",
                    "gender_type",
                    "age_type",
                ],
                required: true,
                include: [
                    {
                        model: Sale,
                        attributes: ["discount_rate", "discount_amount", "sale_flag", "before_price"],
                        required: false,
                    },
                    {
                        model: Video,
                        attributes: ["title"],
                    },
                ],
            },
        ],
    });

    const itemList = likeList.map((like: InstanceType<typeof ItemLike>) => like.Item);

    const totalCount = await ItemLike.count({
        where: { user_id: userId },
        include: [
            {
                model: Item,
                where: itemWhere,
                required: true,
            },
        ],
    });

    return { itemList, totalCount };
};

export const createItemLike = async ({ itemId, userId }: ItemUserParams) => {
    return ItemLike.create({
        item_id: itemId,
        user_id: userId,
    });
};

export const destroyItemLike = async ({ data }: DestroyParams) => {
    await data.destroy();
};

export const destroyItemLikeTransaction = async ({ itemLikes, transaction }: DestroyTransactionParams) => {
    await Promise.all(
        itemLikes.map(async (itemLike: InstanceType<typeof ItemLike>) => {
            await itemLike.destroy({ transaction });
        }),
    );
};

export const deleteItemLikeUserLogical = async ({ userId, transaction }: DeleteItemLikeUserIdTransactionParams) => {
    await ItemLike.destroy({
        where: { user_id: userId },
        transaction,
    });
};

export const countItemLike = async ({ itemId }: ItemIdParams) => {
    return ItemLike.count({
        where: { item_id: itemId },
    });
};
