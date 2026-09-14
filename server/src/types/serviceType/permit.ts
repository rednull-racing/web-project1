import { Transaction } from "sequelize";
import { Permit } from "../../models/index.js";

export type CreatePermitParams = {
    data: {
        s3_metadata_id: number;
        sort_order: number;
        document_name: string | null;
        memo: string | null;
        permit_number: string | null;
        permit_type: string | null;
        issued_at: Date | null;
        expired_at: Date | null;
        shop_info_id: number | null;
        shop_info_edit_id: number | null;
        shop_signup_id: number | null;
    };
    transaction?: Transaction;
};

export type PermitTransactionParams = {
    permit: InstanceType<typeof Permit>;
    transaction: Transaction;
};
