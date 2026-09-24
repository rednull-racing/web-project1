import { Transaction } from "sequelize";
import { Name } from "../../models/index.js";

export type NameIdParams = {
    nameId: number;
};

export type NameUserIdParams = {
    nameId: number;
    userId: number;
};

export type CreateNameFirstParams = {
    transaction?: Transaction;
};

export type CreateNameAllowNullParams = {
    data: {
        sei: string | null;
        mei: string | null;
        sei_kana: string | null;
        mei_kana: string | null;
    };
    transaction?: Transaction;
};

export type CreateNameShopParams = {
    data: {
        sei: string;
        mei: string;
        sei_kana: string;
        mei_kana: string;
        shop_type: "representative" | "contact" | null;
    };
    transaction?: Transaction;
};

export type CreateNameShopAllowNullParams = {
    data: {
        sei: string | null;
        mei: string | null;
        sei_kana: string | null;
        mei_kana: string | null;
        shop_type: "representative" | "contact" | null;
    };
    transaction?: Transaction;
};

export type UpdateNameParams = {
    name: InstanceType<typeof Name>;
    data: {
        sei: string;
        mei: string;
        sei_kana: string;
        mei_kana: string;
    };
    transaction?: Transaction;
};

export type UpdateNameShopParams = {
    name: InstanceType<typeof Name>;
    data: {
        sei: string;
        mei: string;
        sei_kana: string;
        mei_kana: string;
        shop_type: "representative" | "contact" | null;
    };
    transaction?: Transaction;
};

export type NameTransactionParams = {
    name: InstanceType<typeof Name>;
    transaction?: Transaction;
};
