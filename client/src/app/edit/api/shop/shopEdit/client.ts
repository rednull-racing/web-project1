import { ApiError } from "../../../../../lib/api/apiError";
import { apiFetch } from "../../../../../lib/api/client";
import { getAccessToken } from "../../../../../lib/getAccessToken";

type IdUploadBody = {
    frontIdCard: File;
    rearIdCard: File;
    permitFiles: File[];
};

type ShopOtherBody = {
    shopName: string;
    openDateTime: string;
    foundedDate?: Date;
    memberCount: number;
    homepage: string;
    companyNumber: string;
    capital: string;
};

type ComFreeResponse = {
    editId: number;
};

export const fetchCompanyNameEdit = async (shopId: string, companyName: string) => {
    return apiFetch(`/shop-info-edit/${shopId}/company-name`, {
        method: "POST",
        body: JSON.stringify({ companyName }),
    });
};

export const fetchComFreeEdit = async (shopId: string, selectOption: number): Promise<ComFreeResponse> => {
    return apiFetch(`/shop-info-edit/${shopId}/com-free`, {
        method: "POST",
        body: JSON.stringify({ selectOption }),
    });
};

export const fetchShopEditIdUpload = async (shopEditId: string, body: IdUploadBody): Promise<void> => {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        throw new ApiError("UNAUTHORIZED");
    }

    const formData = new FormData();
    formData.append("frontIdCard", body.frontIdCard);
    formData.append("rearIdCard", body.rearIdCard);
    body.permitFiles.forEach((file) => formData.append("permitFiles", file));

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shop-info-edit/${shopEditId}/id-image-upload`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
    });

    if (!res.ok) {
        const data = await res.json();
        throw new ApiError(data.code ?? "API Error");
    }
};

export const fetchUpdateField = async (shopEditId: string, field: string, value: string | number | Date) => {
    return apiFetch(`/shop-info-edit/${shopEditId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
    });
};

export const fetchShopOther = async (shopId: string, body: ShopOtherBody) => {
    return apiFetch(`/shop-info-edit/${shopId}/other`, {
        method: "POST",
        body: JSON.stringify(body),
    });
};
