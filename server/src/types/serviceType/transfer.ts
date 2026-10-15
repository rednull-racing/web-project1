import { InferAttributes, Transaction, WhereOptions } from "sequelize";
import { BankSnapshot } from "../bankSnapshot.js";
import Transfer from "../../models/transfer.js";

export type TransIdParams = {
    transId: number;
};

export type UserIdParams = {
    userId: number;
};

export type TransUserIdParams = {
    transId: number;
    userId: number;
};

export type TransferIdParams = {
    transferId: string;
};

export type TransferHistoryParams = {
    where: WhereOptions<InferAttributes<Transfer>>;
    limit: number;
};

export type CreateTransferParams = {
    data: {
        request_money: number;
        handling_charge: number;
        trans_money: number;
        trans_reason_id: number;
        user_id: number;
        trans_schedule_date: Date;
        transfer_id: string;
        bank_snapshot: BankSnapshot;
    };
    transaction?: Transaction;
};

export type DeleteTransferUserIdTransactionParams = {
    userId: number;
    transaction?: Transaction;
};
