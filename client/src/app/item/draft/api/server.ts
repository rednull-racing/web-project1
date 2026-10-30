import { apiFetchServer } from "../../../../lib/api/server";
import { ItemDraft } from "../types";

type ItemDraftPageResponse = {
    itemDraft: ItemDraft;
};

export const fetchItemDraftPage = async (itemDraftId: string): Promise<ItemDraftPageResponse> => {
    return apiFetchServer(`/item-draft/${itemDraftId}/item-page`, {
        cache: "no-store",
    });
};

type ItemDraftPageMetadataResponse = {
    itemDraft: Pick<ItemDraft, "id" | "name">;
};

export const fetchItemDraftPageMetadata = async (itemDraftId: string): Promise<ItemDraftPageMetadataResponse> => {
    return apiFetchServer(`/item-draft/${itemDraftId}/metadata`, {
        cache: "no-store",
    });
};
