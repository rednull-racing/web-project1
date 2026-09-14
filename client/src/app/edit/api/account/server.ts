import { apiFetchServer } from "../../../../lib/api/server";
import { BankAccount } from "../../type";

type AccountPageResponse = {
    data: BankAccount;
};

export const fetchAccountPage = async (): Promise<AccountPageResponse> => {
    return apiFetchServer("/user/myaccount", {
        cache: "no-store",
    });
};

export const fetchShopAccountPage = async (shopId: string): Promise<AccountPageResponse> => {
    return apiFetchServer(`/shop-info/${shopId}/bank-account`, {
        cache: "no-store",
    });
};

export const fetchShopSignupAccountPage = async (shopSignupId: string): Promise<AccountPageResponse> => {
    return apiFetchServer(`/shop-Signup/${shopSignupId}/bank-account`, {
        cache: "no-store",
    });
};

export const fetchShopEditAccountPage = async (shopEditId: string): Promise<AccountPageResponse> => {
    return apiFetchServer(`/shop-info-edit/${shopEditId}/bank-account`, {
        cache: "no-store",
    });
};
