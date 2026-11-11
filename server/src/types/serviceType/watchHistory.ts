import type { Transaction } from "sequelize";
import type { Item, Sale, Video, WatchHistory } from "../../models/index.js";
import type { ItemWhere } from "./items.js";

export type ItemUserParams = {
    itemId: number;
    userId: number;
};

export type WatchHistoryParams = {
    history: InstanceType<typeof WatchHistory>;
};

export type DeleteWatchHistoryUserIdTransactionParams = {
    userId: number;
    transaction?: Transaction;
};

export type CronDeleteWatchHistoryParams = {
    updatedBefore: Date;
};

export type WatchItemListRow = Pick<
    InstanceType<typeof Item>,
    "id" | "name" | "price" | "status" | "first_image_url" | "gender_type" | "age_type"
> & {
    Video: Pick<InstanceType<typeof Video>, "title"> | null;
    Sale: Pick<InstanceType<typeof Sale>, "before_price" | "sale_flag" | "discount_rate" | "discount_amount"> | null;
};

export type CountWatchItemListParams = {
    userId: number;
    where: ItemWhere;
    transaction: Transaction;
};

export type GetWatchItemListParams = CountWatchItemListParams & {
    limit: number;
    offset: number;
};
