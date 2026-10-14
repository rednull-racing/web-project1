import { Op } from "sequelize";
import type { InferAttributes, Order, Transaction, WhereOptions } from "sequelize";
import type { Item } from "../../models/index.js";
import type ItemModel from "../../models/item.js";
import type ItemShippingProfile from "../../models/item_shipping_profile.js";
import type Sale from "../../models/sale.js";
import type Video from "../../models/video.js";

export type ItemWhere = WhereOptions<InferAttributes<ItemModel>>;

export type ItemIdParams = {
    itemId: number;
};

export type CronPerfectDeleteItemsParams = {
    deletedBefore: Date;
};

export type CronEditingDeleteParams = {
    createdBefore: Date;
};

export type GetItemsSortDecayCronParams = {
    minSortNumber: number;
};

export type GetItemsReportScoreCronParams = {
    minReportScore: number;
};

export type UpdateSortBuzzNumberDecayParams = {
    item: InstanceType<typeof Item>;
    data: {
        sort_buzz_number: number;
    };
};

export type UpdateSortNumberDecayParams = {
    item: InstanceType<typeof Item>;
    data: {
        sort_number: number;
    };
};

export type UserIdParams = {
    userId: number;
};

export type GetAllItemParams = {
    where?: {
        id?: {
            [Op.gt]: number;
        };
    };
    limit?: number;
};

export type UserItemIdParams = {
    userId: number;
    itemId: number;
};

export type GetMyItemWithVideoSaleShippingParams = UserItemIdParams & {
    transaction?: Transaction;
};

export type ItemWithVideoSaleShipping = InstanceType<typeof ItemModel> & {
    Video: InstanceType<typeof Video> | null;
    Sale: InstanceType<typeof Sale> | null;
    ItemShippingProfile: InstanceType<typeof ItemShippingProfile> | null;
};

export type ItemListParams = {
    where: ItemWhere;
    limit: number;
    offset: number;
};

export type RecommendParams = {
    where: ItemWhere;
};

export type ItemPageRecommendParams = {
    where: ItemWhere;
    targetParentId: number;
    categoryRequired: boolean;
};

export type SearchItemParams = {
    limit: number;
    where: ItemWhere;
    order: Order;
};

export type UserIdTransactionParams = {
    userId: number;
    transaction: Transaction;
};

export type ItemTransactionParams = {
    item: InstanceType<typeof Item>;
    transaction: Transaction;
};

export type SortUpdateParams = {
    item: InstanceType<typeof Item>;
    data: {
        sort_number: number;
        sort_buzz_number: number;
    };
};

export type CountUpdateParams = {
    item: InstanceType<typeof Item>;
    data: {
        views_count: number;
    };
};

export type PublishUpdateParams = {
    item: InstanceType<typeof Item>;
    data: {
        sort_number: number;
        sort_buzz_number: number;
        search_text: string;
    };
};

export type UpdateItemImageParams = {
    item: InstanceType<typeof Item>;
    urls: string[];
    transaction: Transaction;
};

export type UpdatePriceParams = {
    item: InstanceType<typeof Item>;
    data: {
        price: number;
    };
    transaction: Transaction;
};

export type UpdateReportScoreParams = {
    item: InstanceType<typeof Item>;
    data: {
        report_score: number;
    };
    transaction?: Transaction;
};

export type ItemDataParams = {
    item: InstanceType<typeof Item>;
};

export type LogicalDeleteParams = {
    item: InstanceType<typeof Item>;
    data: {
        price: number;
    };
    transaction: Transaction;
};
