import { apiFetchServer } from "../../../../lib/api/server";
import { Address } from "../../type";

type AddressPageResponse = {
    data: Address;
};

export const fetchAddressPage = async (): Promise<AddressPageResponse> => {
    return apiFetchServer("/user/myaddress", {
        cache: "no-store",
    });
};

export const fetchPurchaseSessionAddressPage = async (purchaseSessionId: string): Promise<AddressPageResponse> => {
    return apiFetchServer(`/purchase-session/${purchaseSessionId}/address`, {
        cache: "no-store",
    });
};

export const fetchShopAddressPage = async (shopId: string): Promise<AddressPageResponse> => {
    return apiFetchServer(`/shop-info/${shopId}/address`, {
        cache: "no-store",
    });
};

export const fetchShopSignupAddressPage = async (shopSignupId: string): Promise<AddressPageResponse> => {
    return apiFetchServer(`/shop-signup/${shopSignupId}/address`, {
        cache: "no-store",
    });
};

export const fetchShopEditAddressPage = async (shopEditId: string): Promise<AddressPageResponse> => {
    return apiFetchServer(`/shop-info-edit/${shopEditId}/address`, {
        cache: "no-store",
    });
};
