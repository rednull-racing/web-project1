import { Transaction } from "sequelize";

export type GetAllAliasesParams = {
    keyword: string;
    directLength: number;
};

export type NormalizedParams = {
    normalized: string;
};

export type NameNormalizedParams = {
    inputName: string;
    normalized: string;
    transaction?: Transaction;
};
