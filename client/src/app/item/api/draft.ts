import { apiFetch } from "../../../lib/api/client";

export const fetchEditDraftItem = async (itemDraftId: string): Promise<{ itemEditingId: number }> => {
    return apiFetch("/item-editing/draft", {
        method: "POST",
        body: JSON.stringify({ itemDraftId: Number(itemDraftId) }),
    });
};
