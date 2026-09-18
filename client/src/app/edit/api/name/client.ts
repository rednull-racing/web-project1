import { ApiError } from "../../../../lib/api/apiError";
import { getAccessToken } from "../../../../lib/getAccessToken";
import { apiFetch } from "../../../../lib/api/client";

type NameEditBody = {
    sei: string;
    mei: string;
    seiKana: string;
    meiKana: string;
};

type ShopRepNameBody = {
    sei: string;
    mei: string;
    seiKana: string;
    meiKana: string;
    frontFileName?: string;
    frontFileType?: string;
    rearFileName?: string;
    rearFileType?: string;
    idFrontUpload: boolean;
    idRearUpload: boolean;
};

type RepNameShopResponse = {
    frontSignedUrl: string;
    rearSignedUrl: string;
};

type ShopRepNameUpdateBody = NameEditBody & {
    frontIdCard?: File;
    rearIdCard?: File;
    frontS3MetadataId?: number;
    rearS3MetadataId?: number;
};

export const fetchNameEdit = async (nameId: string, body: NameEditBody) => {
    return apiFetch(`/name/${nameId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
    });
};

export const fetchShopEditRepNameCreate = async (
    shopId: string,
    body: ShopRepNameBody,
): Promise<RepNameShopResponse> => {
    return apiFetch(`/shop-info-edit/${shopId}/rep-name`, {
        method: "POST",
        body: JSON.stringify(body),
    });
};

export const fetchShopSignupRepNamePatch = async (shopId: string, body: ShopRepNameUpdateBody): Promise<void> => {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new ApiError("UNAUTHORIZED");

    const formData = new FormData();
    formData.append("sei", body.sei);
    formData.append("mei", body.mei);
    formData.append("seiKana", body.seiKana);
    formData.append("meiKana", body.meiKana);
    if (body.frontIdCard) formData.append("frontIdCard", body.frontIdCard);
    if (body.rearIdCard) formData.append("rearIdCard", body.rearIdCard);
    if (body.frontS3MetadataId !== undefined) formData.append("frontS3MetadataId", String(body.frontS3MetadataId));
    if (body.rearS3MetadataId !== undefined) formData.append("rearS3MetadataId", String(body.rearS3MetadataId));

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shop-signup/${shopId}/rep-name`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
    });
    if (!res.ok) {
        const data = await res.json();
        throw new ApiError(data.code ?? "API Error");
    }
};
