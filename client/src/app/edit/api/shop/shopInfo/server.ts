import { apiFetchServer } from "../../../../../lib/api/server";
import { ComOrFreeOption, ShopInfo } from "../../../type";

type ShopInfoResponse = {
    shop: ShopInfo;
};

type ComFreeResponse = {
    shop: ShopInfo;
    comFree: ComOrFreeOption[];
};

export const fetchComFreePage = async (shopId: string): Promise<ComFreeResponse> => {
    return apiFetchServer(`/shop-info/${shopId}/com-free`, {
        cache: "no-store",
    });
};

export const fetchCompanyNamePage = async (shopId: string): Promise<ShopInfoResponse> => {
    return apiFetchServer(`/shop-info/${shopId}/company-name`, {
        cache: "no-store",
    });
};

export const fetchOptionPage = async (shopId: string): Promise<ShopInfoResponse> => {
    return apiFetchServer(`/shop-info/${shopId}/option`, {
        cache: "no-store",
    });
};

export const fetchOtherPage = async (shopId: string): Promise<ShopInfoResponse> => {
    return apiFetchServer(`/shop-info/${shopId}/other`, {
        cache: "no-store",
    });
};
