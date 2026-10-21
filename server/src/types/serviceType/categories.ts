import type { Transaction } from "sequelize";

export type Level2Params = {
    parentId: number;
};

export type CategoryIdParams = {
    categoryId: number;
    transaction?: Transaction;
};
