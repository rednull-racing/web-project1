import { apiFetch } from "../../../lib/api/client";

type CopyUploadResponse = {
    itemEditingId: number;
};

export const fetchCopyUpload = async (
    itemId: string,
    status: "normal" | "edit" = "normal",
): Promise<CopyUploadResponse> => {
    return apiFetch(`/item-editing/copy?status=${status}`, {
        method: "POST",
        body: JSON.stringify({ itemId: Number(itemId) }),
    });
};
