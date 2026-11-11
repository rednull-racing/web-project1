import { Cart } from "../../models/index.js";
import {
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
