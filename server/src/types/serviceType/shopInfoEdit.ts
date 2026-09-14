import { Transaction } from "sequelize";
import { ShopInfoEdit } from "../../models/index.js";

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
        id_card_front: string | null;
        id_card_rear: string | null;
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
