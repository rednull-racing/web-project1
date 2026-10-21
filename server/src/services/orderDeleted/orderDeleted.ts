import { Transaction } from "sequelize";
import { OrderDeleted } from "../../models/index.js";

type BulkCreateOrderDeletedParams = {
    data: {
        orders_id: number;
        delivery_id: number;
        cancel_reason: string;
        refund_status: string;
        refund_method: string;
        refund_amount: number;
        deleted_by: number;
    }[];
    transaction?: Transaction;
};

export const bulkCreateOrderDeleted = async ({ data, transaction }: BulkCreateOrderDeletedParams) => {
    await OrderDeleted.bulkCreate(data, { transaction });
};
