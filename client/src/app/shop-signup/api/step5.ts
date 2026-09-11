import { apiFetch } from "../../../lib/api/client";

export const fetchUpdateField = async (shopSignupId: string, field: string, value: string | number | Date) => {
    return apiFetch(`/shop-signup/${shopSignupId}/edit`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
    });
};

export const fetchStep5 = async (shopId: string) => {
    return apiFetch(`/shop-info/${shopId}/signup/5`, {
        method: "PATCH",
    });
};
