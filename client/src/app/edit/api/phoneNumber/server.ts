import { apiFetchServer } from "../../../../lib/api/server";
import { ShopInfo, User } from "../../types";

type PhoneNumberResponse = {
    user: User;
};

type ShopPhoneNumberResponse = {
    shop: ShopInfo;
};

export const fetchPhoneNumberPage = async (): Promise<PhoneNumberResponse> => {
    return apiFetchServer("/user/phone-number", {
        cache: "no-store",
    });
};

export const fetchShopPhoneNumberPage = async (shopId: string): Promise<ShopPhoneNumberResponse> => {
    return apiFetchServer(`/shop-info/${shopId}/phone-number`, {
        cache: "no-store",
    });
};
