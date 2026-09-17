import { apiFetchServer } from "../../../../lib/api/server";
import { Name, ShopInfo, ShopSignup } from "../../type";

type NamePageResponse = {
    name: Name;
};

type RepNameResponse = {
    name: Name;
    shop: ShopInfo;
};

type RepNameShopSignupResponse = {
    shopSignup: ShopSignup;
};

export const fetchNamePage = async (): Promise<NamePageResponse> => {
    return apiFetchServer("/user/myname", {
        cache: "no-store",
    });
};

export const fetchPurchaseSessionNamePage = async (purchaseSessionId: string): Promise<NamePageResponse> => {
    return apiFetchServer(`/purchase-session/${purchaseSessionId}/name`, {
        cache: "no-store",
    });
};

export const fetchShopConNamePage = async (shopId: string): Promise<NamePageResponse> => {
    return apiFetchServer(`/shop-info/${shopId}/con-name`, {
        cache: "no-store",
    });
};

export const fetchShopSignupConNamePage = async (shopSignupId: string): Promise<NamePageResponse> => {
    return apiFetchServer(`/shop-signup/${shopSignupId}/con-name`, {
        cache: "no-store",
    });
};

export const fetchShopEditConNamePage = async (shopEditId: string): Promise<NamePageResponse> => {
    return apiFetchServer(`/shop-info-edit/${shopEditId}/con-name`, {
        cache: "no-store",
    });
};

export const fetchShopRepNamePage = async (shopId: string): Promise<RepNameResponse> => {
    return apiFetchServer(`/shop-info/${shopId}/rep-name`, {
        cache: "no-store",
    });
};

export const fetchShopSignupRepNamePage = async (shopSignupId: string): Promise<RepNameShopSignupResponse> => {
    return apiFetchServer(`/shop-signup/${shopSignupId}/rep-name`, {
        cache: "no-store",
    });
};

export const fetchShopEditRepNamePage = async (shopEditId: string): Promise<NamePageResponse> => {
    return apiFetchServer(`/shop-info-edit/${shopEditId}/rep-name`, {
        cache: "no-store",
    });
};
