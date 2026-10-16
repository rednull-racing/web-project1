import { Transaction } from "sequelize";
import { Cancel } from "../../models/index.js";

type UpsertCancelParams = {
    data: {
        orders_id: number;
        cancel_reason: string;
        return_amount: number;
        item_count: number;
        cancel_flag: boolean;
        cancel_fee_return_id: number;
    };
    transaction?: Transaction;
};

export const upsertCancel = async ({ data, transaction }: UpsertCancelParams) => {
    await Cancel.upsert(data, { transaction });
};
