import { Transaction } from "sequelize";
import type IdCardModel from "../../models/id_card.js";
import { ShopInfoEdit } from "../../models/index.js";
import type PermitModel from "../../models/permit.js";
import type S3MetadataModel from "../../models/s3_metadata.js";
import type ShopEditModel from "../../models/shop_info_edit.js";

export type ShopEditWithS3Data = ShopEditModel & {
    IdCard?: (IdCardModel & { FrontIdCard?: S3MetadataModel | null; RearIdCard?: S3MetadataModel | null }) | null;
    Permit?: (PermitModel & { S3Metadata?: S3MetadataModel | null })[];
};

export type ShopEditIdParams = {
    shopEditId: number;
};

export type ShopEditUserIdParams = {
    shopEditId: number;
    userId: number;
};

export type CreateShopEditParams = {
    data: {
        user_id: number;
        shop_info_id: number;
        address_id?: number;
        account_id?: number;
    };
    transaction?: Transaction;
};

export type CreateShopEditWithIdCardParams = {
    data: {
        user_id: number;
        shop_info_id: number;
        idcard_id: number;
        name_representative_id: number;
    };
    transaction?: Transaction;
};

export type CreateShopEditCompanyNameParams = {
    data: {
        user_id: number;
        shop_info_id: number;
        company_name: string;
    };
    transaction?: Transaction;
};

export type CreateShopEditComFreeParams = {
    data: {
        company_name: string | null;
        phone_number: string | null;
        email: string | null;
        open_date_time: string | null;
        founded_date: Date | null;
        member_count: number | null;
        homepage_url: string | null;
        company_number: string | null;
        capital: number | null;
        user_id: number;
        shop_info_id: number;
        com_or_free_id: number;
        name_representative_id: number;
        name_contact_id: number;
        address_id: number;
        account_id: number;
    };
    transaction?: Transaction;
};

export type ShopInfoEditUpdateData =
    | { company_name: string }
    | { phone_number: string }
    | { email: string }
    | { open_date_time: string }
    | { founded_date: Date }
    | { member_count: number }
    | { homepage_url: string }
    | { company_number: string }
    | { capital: number };

export type UpdateShopEditAnyParams = {
    shopEdit: InstanceType<typeof ShopInfoEdit>;
    data: ShopInfoEditUpdateData;
    transaction?: Transaction;
};

export type UpdateShopEditIdPermitParams = {
    shopEdit: InstanceType<typeof ShopInfoEdit>;
    data: {
        idcard_id: number;
    };
    transaction?: Transaction;
};
