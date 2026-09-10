import { Transaction } from "sequelize";
import { ShopSignup } from "../../models/index.js";

export type UserIdParams = {
    userId: number;
};

export type UserShopSignupIdParams = {
    userId: number;
    shopSignupId: number;
};

export type CreateShopSignupParams = {
    data: {
        company_name: string;
        shop_name: string;
        phone_number: string;
        email: string;
        homepage_url: string | null;
        open_date_time: string;
        company_number: string | null;
        capital: number;
        member_count: number;
        user_id: number;
        address_id: number;
        com_or_free_id: number;
        founded_date: Date;
        name_representative_id: number;
        name_contact_id: number;
    };
    transaction?: Transaction;
};

export type UpdateBankAccountParams = {
    shopSignup: InstanceType<typeof ShopSignup>;
    data: {
        account_id: number;
    };
    transaction?: Transaction;
};

export type UpdateSignup3Params = {
    shopSignup: InstanceType<typeof ShopSignup>;
    data: {
        idcard_id: number;
    };
    transaction?: Transaction;
};

export type UpdateOptionParams = {
    shopSignup: InstanceType<typeof ShopSignup>;
    data: {
        auto_trans: boolean;
        open_info: boolean;
    };
    transaction?: Transaction;
};

export type ShopSignupUpdateData =
    | { com_or_free_id: number }
    | { company_name: string }
    | { shop_name: string }
    | { phone_number: string }
    | { email: string }
    | { open_date_time: string }
    | { founded_date: Date }
    | { member_count: number }
    | { homepage_url: string }
    | { company_number: string }
    | { capital: number }
    | { auto_trans: boolean }
    | { open_info: boolean };

export type UpdateShopSignupAnyParams = {
    shopSignup: InstanceType<typeof ShopSignup>;
    data: ShopSignupUpdateData;
    transaction?: Transaction;
};

export type UpdateShopSignupRequestAllParams = {
    shopSignup: InstanceType<typeof ShopSignup>;
    data: {
        request_all: boolean;
    };
    transaction?: Transaction;
};
