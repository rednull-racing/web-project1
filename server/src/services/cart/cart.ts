import { Cart, Item, Sale, Video } from "../../models/index.js";
import {
    CartListParams,
    DeleteCartUserTransactionParams,
    DestroyAllParams,
    DestroyParams,
    ItemIdParams,
    ItemUserParams,
} from "../../types/serviceType/cart.js";

export const getCartOne = async ({ itemId, userId }: ItemUserParams) => {
    return Cart.findOne({
        where: {
            user_id: userId,
            item_id: itemId,
        },
    });
};

export const getAllCarts = async ({ itemId }: ItemIdParams) => {
    return Cart.findAll({
        where: { item_id: itemId },
    });
};

export const getUserItemsCartList = async ({ itemWhere, limit, offset, userId }: CartListParams) => {
    const cartList = await Cart.findAll({
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

    const itemList = cartList.map((cart: InstanceType<typeof Cart>) => cart.Item);

    const totalCount = await Cart.count({
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

export const createCart = async ({ itemId, userId }: ItemUserParams) => {
    return Cart.create({
        user_id: userId,
        item_id: itemId,
    });
};

export const destroyCart = async ({ cart }: DestroyParams) => {
    await cart.destroy();
};

export const destroyAllCarts = async ({ carts, transaction }: DestroyAllParams) => {
    await Promise.all(
        carts.map(async (cart: InstanceType<typeof Cart>) => {
            await cart.destroy({ transaction });
        }),
    );
};

export const deleteCartUserLogical = async ({ userId, transaction }: DeleteCartUserTransactionParams) => {
    await Cart.destroy({
        where: { user_id: userId },
        transaction,
    });
};
