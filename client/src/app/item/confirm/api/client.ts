import { apiFetch } from "../../../../lib/api/client";

export const fetchCreateItem = async (itemEditingId: string): Promise<{ itemId: number }> => {
    return apiFetch("/items", {
        method: "POST",
        body: JSON.stringify({ itemEditingId: Number(itemEditingId) }),
    });
};

export const fetchEditItem = async (itemEditingId: string): Promise<{ itemId: number }> => {
    return apiFetch("/items", {
        method: "PUT",
        body: JSON.stringify({ itemEditingId: Number(itemEditingId) }),
    });
};
