import type { Transaction } from "sequelize";
import type { Item, ItemLike, Sale, ShopInfo, User, Video } from "../../models/index.js";
import type { ItemWhere } from "./items.js";

export type ItemUserParams = {
    itemId: number;
    userId: number;
};

export type ItemIdParams = {
    itemId: number;
};

export type ListParams = {
    itemId: number;
    keyword?: string;
};

export type UserItemsLikesParams = {
    userId: number;
    itemWhere: ItemWhere;
    limit: number;
    offset: number;
};

export type DestroyParams = {
    data: InstanceType<typeof ItemLike>;
};

export type DestroyTransactionParams = {
    itemLikes: InstanceType<typeof ItemLike>[];
    transaction: Transaction;
};

export type DeleteItemLikeUserIdTransactionParams = {
    userId: number;
    transaction?: Transaction;
};

export type ItemLikeWithUser = InstanceType<typeof ItemLike> & {
    User: InstanceType<typeof User> & {
        ShopInfo: InstanceType<typeof ShopInfo> | null;
    };
};

export type ItemLikeListRow = Pick<
    InstanceType<typeof Item>,
    "id" | "name" | "price" | "status" | "first_image_url" | "gender_type" | "age_type"
> & {
    Video: Pick<InstanceType<typeof Video>, "title"> | null;
    Sale: Pick<InstanceType<typeof Sale>, "before_price" | "sale_flag" | "discount_rate" | "discount_amount"> | null;
};

export type CountItemLikeListParams = {
    userId: number;
    where: ItemWhere;
    transaction: Transaction;
};

export type GetItemLikeListParams = CountItemLikeListParams & {
    limit: number;
    offset: number;
};
