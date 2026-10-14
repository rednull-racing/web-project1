import { Transaction } from "sequelize";
import { Sale } from "../../models/index.js";

export type SaleIdParams = {
    saleId: number;
};

export type CreateSaleParams = {
    itemId: number;
    transaction: Transaction;
};

export type LogicalDeleteUpdateParams = {
    sale: InstanceType<typeof Sale>;
    transaction: Transaction;
};

export type UpdateSaleParams = {
    sale: InstanceType<typeof Sale>;
    data: {
        before_price: number;
    };
    transaction: Transaction;
};

export type UpdateSaleEditParams = {
    sale: InstanceType<typeof Sale>;
    data: {
        discount_rate: number;
        discount_amount: number;
        sale_flag: boolean;
    };
    transaction: Transaction;
};
