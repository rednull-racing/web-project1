import { Transaction } from "sequelize";

export type CreateItemEditingParams = {
    data: {
        seller_id: number;
    };
    transaction?: Transaction;
};
