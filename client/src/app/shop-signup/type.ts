import { AccountType } from "../../types/bankSnapshot";

export type ComOrFreeOption = {
    id: number;
    name: string;
};

export type TodouhukenOption = {
    id: number;
    name: string;
};

export type S3Metadata = {
    id: number;
    original_file_name: string | null;
    content_type: string | null;
    file_size: number | null;
};

export type Permit = {
    id: number;
    document_name: string | null;
    memo: string | null;
    permit_number: string | null;
    permit_type: string | null;
    issued_at: Date | null;
    expired_at: Date | null;
    S3Metadata?: S3Metadata;
};

export type IdCard = {
    id: number;
    FrontIdCard?: S3Metadata;
    RearIdCard?: S3Metadata;
};

export type BankAccount = {
    id: string;
    bank_name: string;
    bank_code: string;
    branch: string;
    branch_code: string;
    account_type: AccountType;
    account_number: string;
    meigi: string;
};

export type Address = {
    id: string;
    post_number: string;
    shikutyouson: string;
    banchi: string;
    building?: string;
    AddressTodouhuken?: TodouhukenOption;
};

export type Name = {
    id: string;
    sei: string;
    mei: string;
    sei_kana: string;
    mei_kana: string;
};

export type ShopSignup = {
    id: string;
    company_name?: string;
    shop_name?: string;
    email?: string;
    phone_number?: string;
    homepage_url?: string | null;
    open_date_time?: string;
    company_number?: string;
    capital?: number;
    member_count?: number;
    founded_date?: Date;
    auto_trans: boolean;
    open_info: boolean;
    ComOrFreeOption?: ComOrFreeOption;
    Address?: Address;
    RepresentativeName?: Name;
    ContactName?: Name;
    BankAccount?: BankAccount;
    IdCard?: IdCard;
    Permit?: Permit[];
};

export type User = {
    id: string;
    user_name: string;
    email: string;
    phone_number: string;
    Address?: Address;
    Name?: Name;
    BankAccount?: BankAccount;
};
