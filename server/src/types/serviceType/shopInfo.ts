import { Transaction } from "sequelize";
import type IdCardModel from "../../models/id_card.js";
import { ShopInfo } from "../../models/index.js";
import type PermitModel from "../../models/permit.js";
import type S3MetadataModel from "../../models/s3_metadata.js";
import type ShopInfoModel from "../../models/shop_info.js";

export type ShopInfoWithS3Data = ShopInfoModel & {
    IdCard?: (IdCardModel & { FrontIdCard?: S3MetadataModel | null; RearIdCard?: S3MetadataModel | null }) | null;
    Permit?: (PermitModel & { S3Metadata?: S3MetadataModel | null })[];
};

export type ShopIdParams = {
    shopId: number;
};

export type UserIdParams = {
    userId: number;
};

export type UserShopIdParams = {
    userId: number;
    shopId: number;
};

export type UpdateShopEmailParams = {
    shopInfo: InstanceType<typeof ShopInfo>;
    data: {
        email: string;
    };
    transaction?: Transaction;
};

export type UpdateShopIdCardParams = {
    shopInfo: InstanceType<typeof ShopInfo>;
    data: {
        idcard_id: number;
    };
    transaction?: Transaction;
};

export type UpdateShopPhoneNumberParams = {
    shopInfo: InstanceType<typeof ShopInfo>;
    data: {
        phone_number: string;
    };
    transaction?: Transaction;
};

export type UpdateShopNameParams = {
    shopInfo: InstanceType<typeof ShopInfo>;
    data: {
        shop_name: string;
    };
    transaction?: Transaction;
};

export type UpdateCompanyNameParams = {
    shopInfo: InstanceType<typeof ShopInfo>;
    data: {
        company_name: string;
    };
    transaction?: Transaction;
};

export type UpdateOptionParams = {
    shopInfo: InstanceType<typeof ShopInfo>;
    data: {
        auto_trans: boolean;
        open_info: boolean;
    };
    transaction?: Transaction;
};

export type UpdateBankAccountParams = {
    shopInfo: InstanceType<typeof ShopInfo>;
    data: {
        account_id: number;
    };
    transaction?: Transaction;
};

export type UpdateShopUserLogicalDeleteParams = {
    shopInfo: InstanceType<typeof ShopInfo>;
    data: {
        user_id: null;
    };
    transaction?: Transaction;
};

export type ShopInfoUpdateData =
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

export type UpdateShopAnyParams = {
    shopInfo: InstanceType<typeof ShopInfo>;
    data: ShopInfoUpdateData;
    transaction?: Transaction;
};

export type ShopTransactionParams = {
    shopInfo: InstanceType<typeof ShopInfo>;
    transaction?: Transaction;
};
