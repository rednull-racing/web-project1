import { Transaction } from "sequelize";
import { Cart } from "../../models/index.js";
import type { ItemWhere } from "./items.js";

export type ItemUserParams = {
    itemId: number;
    userId: number;
};

export type ItemIdParams = {
    itemId: number;
};

export type CartListParams = {
    userId: number;
    itemWhere: ItemWhere;
    limit: number;
    offset: number;
};

export type DestroyParams = {
    cart: InstanceType<typeof Cart>;
};

export type DestroyAllParams = {
    carts: InstanceType<typeof Cart>[];
    transaction?: Transaction;
};

export type DeleteCartUserTransactionParams = {
    userId: number;
    transaction?: Transaction;
};
