import { apiFetch } from "@/lib/api/client";

export const fetchRemoveCart = async (itemId: string) => {
    return apiFetch(`/cart/${itemId}`, {
        method: "DELETE",
    });
};
