import { apiFetch } from "../../../lib/api/client";

export const fetchVideoConvert = async (itemEditingId: string) => {
    return apiFetch(`/item-editing/${itemEditingId}/convert`, {
        method: "PATCH",
    });
};
