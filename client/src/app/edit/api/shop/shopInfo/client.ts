import { apiFetch } from "../../../../../lib/api/client";

type OptionBody = {
    autoTrans: boolean;
    openInfo: boolean;
};

type ShopOtherBody = {
    shopName: string;
    openDateTime: string;
    foundedDate?: Date;
    memberCount: number;
    homepage: string;
    companyNumber: string;
    capital: number;
};

export const fetchOptionEdit = async (shopId: string, body: OptionBody) => {
    return apiFetch(`/shop-info/${shopId}/option`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
};

export const fetchShopOther = async (shopId: string, body: ShopOtherBody) => {
    return apiFetch(`/shop-info/${shopId}/other`, {
        method: "POST",
        body: JSON.stringify(body),
    });
};
