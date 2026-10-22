import { apiFetch } from "../../../lib/api/client";

type CopyUploadResponse = {
    itemEditingId: number;
};

export const fetchCopyUpload = async (itemId: string): Promise<CopyUploadResponse> => {
    return apiFetch("/item-editing/copy", {
        method: "POST",
        body: JSON.stringify({ itemId: Number(itemId) }),
    });
};
