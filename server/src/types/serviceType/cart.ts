import type { Transaction } from "sequelize";
import type { Cart, Item, Sale, Video } from "../../models/index.js";
import type { ItemWhere } from "./items.js";

export type ItemUserParams = {
    itemId: number;
    userId: number;
};

export type ItemIdParams = {
    itemId: number;
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

export type CartItemListRow = Pick<
    InstanceType<typeof Item>,
    "id" | "name" | "price" | "status" | "first_image_url" | "gender_type" | "age_type"
> & {
    Video: Pick<InstanceType<typeof Video>, "title"> | null;
    Sale: Pick<InstanceType<typeof Sale>, "before_price" | "sale_flag" | "discount_rate" | "discount_amount"> | null;
};

export type CountCartItemListParams = {
    userId: number;
    where: ItemWhere;
    transaction: Transaction;
};

export type GetCartItemListParams = CountCartItemListParams & {
    limit: number;
    offset: number;
};
