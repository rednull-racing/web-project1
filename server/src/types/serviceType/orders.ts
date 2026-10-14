import type { InferAttributes, Transaction, WhereOptions } from "sequelize";
import type { Orders } from "../../models/index.js";

export type OrderWhere = WhereOptions<InferAttributes<InstanceType<typeof Orders>>>;

export type OrderListParams = {
    where: OrderWhere;
    limit: number;
    offset: number;
};

export type ItemIdParams = {
    itemId: number;
};

export type UpdateOrderStatusParams = {
    order: InstanceType<typeof Orders>;
    data: {
        status: "pending" | "paid" | "shipped" | "completed" | "cancelled" | "returned";
    };
    transaction?: Transaction;
};
