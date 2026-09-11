import { ApiError } from "../../../lib/api/apiError";
import { getAccessToken } from "../../../lib/getAccessToken";

type IdUploadBody = {
    frontIdCard: File | null;
    frontS3MetadataId?: number;
    rearIdCard: File | null;
    rearS3MetadataId?: number;
    requiresPermit: boolean;
    permits: { file: File | null; s3MetadataId?: number }[];
};

export const fetchStep3 = async (shopId: string, body: IdUploadBody): Promise<void> => {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        throw new ApiError("UNAUTHORIZED");
    }

    const formData = new FormData();
    if (body.frontIdCard) formData.append("frontIdCard", body.frontIdCard);
    if (body.frontS3MetadataId) formData.append("frontS3MetadataId", String(body.frontS3MetadataId));
    if (body.rearIdCard) formData.append("rearIdCard", body.rearIdCard);
    if (body.rearS3MetadataId) formData.append("rearS3MetadataId", String(body.rearS3MetadataId));
    formData.append("requiresPermit", String(body.requiresPermit));

    let fileIndex = 0;
    body.permits.forEach((permit, index) => {
        if (permit.file) {
            formData.append("permitFiles", permit.file);
            formData.append(`permits[${index}][fileIndex]`, String(fileIndex++));
        }
        if (permit.s3MetadataId) {
            formData.append(`permits[${index}][s3MetadataId]`, String(permit.s3MetadataId));
        }
    });

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shop-signup/${shopId}/id-card`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
    });

    if (!res.ok) {
        const data = await res.json();
        throw new ApiError(data.code ?? "API Error");
    }
};
