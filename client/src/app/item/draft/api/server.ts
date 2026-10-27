import { apiFetchServer } from "../../../../lib/api/server";
import { ItemDraft } from "../types";

type ItemDraftPageResponse = {
    itemDraft: ItemDraft;
};

export const fetchItemDraftPage = async (itemDraftId: string): Promise<ItemDraftPageResponse> => {
    return apiFetchServer(`/item-draft/${itemDraftId}`, {
        cache: "no-store",
    });
};
