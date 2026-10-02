import { apiFetch } from "../../../../../lib/api/client";

type OptionBody = {
    autoTrans: boolean;
    openInfo: boolean;
};

type ShopOtherBody = {
    shopName: string;
    openDateTime: string | null;
    foundedDate?: Date;
    memberCount: number;
    homepage: string | null;
    companyNumber: string | null;
    capital: number | null;
};

export const fetchOptionEdit = async (shopId: string, body: OptionBody) => {
    return apiFetch(`/shop-info/${shopId}/option`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
};

export const fetchShopOther = async (shopId: string, body: ShopOtherBody) => {
    return apiFetch(`/shop-info/${shopId}/other`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
};
