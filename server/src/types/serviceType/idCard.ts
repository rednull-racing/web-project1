import { Transaction } from "sequelize";
import { IdCard } from "../../models/index.js";

export type IdCardUserIdParams = {
    idCardId: number;
    userId: number;
};

export type CreateIdFirstParams = {
    transaction?: Transaction;
};

export type CreateIdParams = {
    data: {
        front_s3_metadata_id: number;
        rear_s3_metadata_id: number;
    };
    transaction?: Transaction;
};

export type UpdateIdParams = {
    idCard: InstanceType<typeof IdCard>;
    data: {
        front_s3_metadata_id: number;
        rear_s3_metadata_id: number;
    };
    transaction?: Transaction;
};

export type IdCardTransactionParams = {
    idCard: InstanceType<typeof IdCard>;
    transaction?: Transaction;
};
