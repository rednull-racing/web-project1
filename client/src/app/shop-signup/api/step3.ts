import { ApiError } from "../../../lib/api/apiError";
import { getAccessToken } from "../../../lib/getAccessToken";

type IdUploadBody = {
    frontIdCard: File;
    rearIdCard: File;
    permitFiles: File[];
};

export const fetchStep3 = async (shopId: string, body: IdUploadBody): Promise<void> => {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        throw new ApiError("UNAUTHORIZED");
    }

    const formData = new FormData();
    formData.append("frontIdCard", body.frontIdCard);
    formData.append("rearIdCard", body.rearIdCard);
    body.permitFiles.forEach((file) => formData.append("permitFiles", file));

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
