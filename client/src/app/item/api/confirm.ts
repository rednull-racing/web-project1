import { apiFetch } from "../../../lib/api/client";

export const fetchPublishItem = async (itemEditingId: string): Promise<{ itemId: number }> => {
    return apiFetch("/items", {
        method: "POST",
        body: JSON.stringify({ itemEditingId: Number(itemEditingId) }),
    });
};
