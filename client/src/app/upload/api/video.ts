import { apiFetch } from "../../../lib/api/client";

export const fetchVideoConvert = async (itemEditingId: string, signal?: AbortSignal) => {
    return apiFetch(`/item-editing/${itemEditingId}/convert`, {
        method: "PATCH",
        ...(signal ? { signal } : {}),
    });
};

export const fetchDraftVideoConvert = async (itemDraftId: number, signal?: AbortSignal) => {
    return apiFetch(`/item-draft/${itemDraftId}/convert`, {
        method: "PATCH",
        ...(signal ? { signal } : {}),
    });
};

export type VideoConversionState = {
    video_status: "processing" | "converted" | "failed" | null;
    converted_url: string | null;
};

export const fetchVideoConversionState = async (
    target: "editing" | "draft",
    id: string | number,
    signal?: AbortSignal,
): Promise<VideoConversionState> => {
    const data = await apiFetch<{ itemEditing?: VideoConversionState; itemDraft?: VideoConversionState }>(
        target === "editing" ? `/item-editing/${id}/form` : `/item-draft/${id}/item-page`,
        { cache: "no-store", signal },
    );
    const state = target === "editing" ? data.itemEditing : data.itemDraft;
    if (!state) throw new Error("動画の処理状態を取得できませんでした");
    return state;
};
