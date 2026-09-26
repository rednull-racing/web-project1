import { ApiError } from "../../../../lib/api/apiError";
import { getAccessToken } from "../../../../lib/getAccessToken";

type IdCardUpdateBody = {
    frontIdCard?: File;
    rearIdCard?: File;
};

export const fetchIdCardSubmit = async (idCardId: number, body: IdCardUpdateBody) => {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new ApiError("UNAUTHORIZED");

    const formData = new FormData();
    if (body.frontIdCard) formData.append("frontIdCard", body.frontIdCard);
    if (body.rearIdCard) formData.append("rearIdCard", body.rearIdCard);

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/id-card/${idCardId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
    });

    if (!res.ok) {
        const data = await res.json();
        throw new ApiError(data.code ?? "API Error");
    }
};
