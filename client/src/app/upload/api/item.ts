import { apiFetch } from "../../../lib/api/client";
import { Body } from "../types/uploadType";

export type PresignedPost = {
    url: string;
    fields: Record<string, string>;
};

type SignedUrlWithIndex = {
    index: number;
    url: string;
};

type UploadResponse = {
    videoSignedUrl: PresignedPost | null;
    thumbnailSignedUrl: string | null;
    itemImageSignedUrls: SignedUrlWithIndex[];
    attributesImageSignedUrls: Record<string, string>;
};

type DraftUploadResponse = UploadResponse & {
    itemDraftId: number;
};

export const fetchDraft = async (itemEditingId: string, body: Body): Promise<DraftUploadResponse> => {
    return apiFetch("/item-draft", {
        method: "POST",
        body: JSON.stringify({ ...body, itemEditingId: Number(itemEditingId) }),
    });
};

export const fetchMain = async (itemEditingId: string, body: Body): Promise<UploadResponse> => {
    return apiFetch(`/item-editing/${itemEditingId}`, {
        method: "PUT",
        body: JSON.stringify(body),
    });
};
