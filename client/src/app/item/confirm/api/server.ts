import { apiFetchServer } from "../../../../lib/api/server";
import { ItemEditing } from "../types";

type ItemEditingPageResponse = {
    itemEditing: ItemEditing;
};

export const fetchItemConfirmPage = async (itemEditingId: string): Promise<ItemEditingPageResponse> => {
    return apiFetchServer(`/item-editing/${itemEditingId}/confirm`, {
        cache: "no-store",
    });
};
