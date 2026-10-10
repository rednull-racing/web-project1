import { InferAttributes, Op, Order, Transaction, WhereOptions } from "sequelize";
import { Item } from "../../models/index.js";
import { ItemAttributes } from "../itemAttributes.js";

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

export type ItemListParams = {
    where: any;
    limit: number;
    offset: number;
};

export type RecommendParams = {
    where: any;
};

export type ItemPageRecommendParams = {
    where: any;
    targetParentId: number;
    categoryRequired: boolean;
};

export type SearchItemParams = {
    limit: number;
    where: WhereOptions<InferAttributes<typeof Item>>;
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

export type CreateItemCopyUploadParams = {
    data: {
        name: string;
        detail: string;
        price: number;
        item_condition_id: number;
        seller_id: number;
        search_text: string;
        image_url: string | string[];
        first_image_url: string;
        gender_type: string;
        age_type: string;
        category_id: number;
        brand_id: number | null;
        attributes: ItemAttributes;
    };
    transaction: Transaction;
};
