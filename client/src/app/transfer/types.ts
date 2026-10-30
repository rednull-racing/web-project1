import { AccountType, BankSnapshot } from "../../types/bankSnapshot";

export type TransferHistoryResponse = {
    history: Transfer[];
    nextCursor: string | null;
    hasMore: boolean;
};

export type BankAccount = {
    id: string;
    bank_name: string;
    branch: string;
    account_type: AccountType | null;
    account_number: string;
    meigi: string;
};

export type TransReasonOption = {
    id: string;
    name: string;
};

export type Transfer = {
    id: string;
    request_money: number;
    handling_charge: number;
    trans_money: number;
    trans_finish: boolean;
    trans_schedule_date: Date;
    trans_at: Date;
    createdAt: Date;
    transfer_id: string;
    bank_snapshot: BankSnapshot;
    User: User | null;
    TransReasonOption: TransReasonOption | null;
};

export type User = {
    id: string;
    uriagekin: number;
    points: number;
    BankAccount: BankAccount | null;
};
