import { apiFetch } from "../../../lib/api/client";

type OptionBody = {
    autoTrans: boolean;
    openInfo: boolean;
};

export const fetchStep4 = async (shopSignupId: string, body: OptionBody) => {
    return apiFetch(`/shop-signup/${shopSignupId}/option`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
};
