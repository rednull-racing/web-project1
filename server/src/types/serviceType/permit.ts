import { Transaction } from "sequelize";
import { Permit } from "../../models/index.js";

export type CreatePermitParams = {
    data: {
        permit_number: string | null;
        permit_type: string | null;
        issued_at: Date | null;
        expired_at: Date | null;
    };
    transaction?: Transaction;
};

export type PermitTransactionParams = {
    permit: InstanceType<typeof Permit>;
    transaction: Transaction;
};
