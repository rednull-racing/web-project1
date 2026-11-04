import { useCallback, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { fetchDraftVideoConvert, fetchVideoConvert, fetchVideoConversionState } from "../api/video";
import type { PresignedPost } from "../api/item";
import type { AttributesValue } from "../attributes";
import type { ItemImageValue } from "../itemImage";

type VideoArgs = {
    videoFile: File | null;
    videoSignedUrl: PresignedPost | null;
    onUploaded?: () => void;
} & ({ target: "editing"; itemEditingId: string } | { target: "draft"; itemDraftId: number });
type ThumbnailArgs = { thumbnailFile: File | null; thumbnailSignedUrl: string | null; onUploaded?: () => void };
type ItemImageArgs = { itemImageFiles: ItemImageValue[]; itemImageSignedUrls: { index: number; url: string }[]; onUploaded?: (id: string) => void };
type AttributesImageArgs = { attributesValue: AttributesValue; signedUrlMap: Record<string, string> | null | undefined; onUploaded?: (uiId: string) => void };

export const useFileUpload = () => {
    const completed = useRef(new WeakMap<File, Set<string>>());
    const inFlight = useRef(new WeakMap<File, Map<string, Promise<void>>>());
    const conversions = useRef(new WeakMap<File, Map<string, { baselineUrl: string | null; processingSeen: boolean }>>());
    const controller = useRef<AbortController | null>(null);
    const cancelUploads = useCallback(() => { controller.current?.abort(); }, []);
    useEffect(() => cancelUploads, [cancelUploads]);
    const getSignal = () => {
        if (!controller.current || controller.current.signal.aborted) controller.current = new AbortController();
        return controller.current.signal;
    };
    const hasCompleted = (file: File, key: string) => completed.current.get(file)?.has(key) ?? false;
    const markCompleted = (file: File, key: string) => {
        const keys = completed.current.get(file) ?? new Set<string>();
        keys.add(key);
        completed.current.set(file, keys);
    };
    const put = async (file: File, url: string, signal: AbortSignal) => {
        if (hasCompleted(file, url)) return;
        const pending = inFlight.current.get(file) ?? new Map<string, Promise<void>>();
        inFlight.current.set(file, pending);
        const existing = pending.get(url);
        if (existing) return existing;
        const operation = (async () => {
            const response = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file, signal });
            if (!response.ok) throw new Error("ファイルの転送に失敗しました");
            markCompleted(file, url);
        })();
        pending.set(url, operation);
        try { await operation; }
        finally { if (pending.get(url) === operation) pending.delete(url); }
    };

    const videoUploadAndConvert = async (args: VideoArgs): Promise<boolean> => {
        const { videoFile, videoSignedUrl } = args;
        if (!videoFile && !videoSignedUrl) return true;
        if (!videoFile || !videoSignedUrl) {
            toast.error("動画のアップロード情報が不足しています");
            return false;
        }
        const signal = getSignal();
        const id = args.target === "editing" ? args.itemEditingId : args.itemDraftId;
        const postKey = JSON.stringify(videoSignedUrl);
        const conversionKey = `${postKey}:${args.target}:${id}:converted`;
        if (hasCompleted(videoFile, conversionKey)) { args.onUploaded?.(); return true; }
        if (!hasCompleted(videoFile, postKey)) {
            const formData = new FormData();
            Object.entries(videoSignedUrl.fields).forEach(([key, value]) => formData.append(key, value));
            formData.append("file", videoFile);
            const response = await fetch(videoSignedUrl.url, { method: "POST", body: formData, signal });
            if (!response.ok) { toast.error("動画のアップロードに失敗しました"); return false; }
            markCompleted(videoFile, postKey);
        }
        const previous = await fetchVideoConversionState(args.target, id, signal);
        const records = conversions.current.get(videoFile) ?? new Map<string, { baselineUrl: string | null; processingSeen: boolean }>();
        conversions.current.set(videoFile, records);
        let progress = records.get(conversionKey);
        if (!progress || previous.video_status === "failed") {
            progress = { baselineUrl: previous.converted_url, processingSeen: false };
            if (args.target === "draft") await fetchDraftVideoConvert(args.itemDraftId, signal);
            else await fetchVideoConvert(args.itemEditingId, signal);
            records.set(conversionKey, progress);
        } else {
            if (previous.video_status === "processing") progress.processingSeen = true;
            if (previous.video_status === "converted" && previous.converted_url &&
                (progress.processingSeen || previous.converted_url !== progress.baselineUrl)) {
                markCompleted(videoFile, conversionKey);
                args.onUploaded?.();
                return true;
            }
        }
        // 202は受付のみ。旧converted状態を今回の完了として扱わない。
        for (let attempt = 0; attempt < 120; attempt++) {
            await new Promise<void>((resolve, reject) => {
                if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
                const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
                const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 1000);
                signal.addEventListener("abort", abort, { once: true });
            });
            const state = await fetchVideoConversionState(args.target, id, signal);
            if (state.video_status === "processing") progress.processingSeen = true;
            if (state.video_status === "failed") { toast.error("動画の変換に失敗しました"); return false; }
            if (state.video_status === "converted" && state.converted_url &&
                (progress.processingSeen || state.converted_url !== progress.baselineUrl)) {
                markCompleted(videoFile, conversionKey);
                args.onUploaded?.();
                return true;
            }
        }
        toast.error("動画の変換を確認できませんでした。時間をおいて再試行してください");
        return false;
    };

    const thumbnailUpload = async ({ thumbnailFile, thumbnailSignedUrl, onUploaded }: ThumbnailArgs): Promise<boolean> => {
        if (!thumbnailFile && !thumbnailSignedUrl) return true;
        if (!thumbnailFile || !thumbnailSignedUrl) { toast.error("サムネイルのアップロード情報が不足しています"); return false; }
        try { await put(thumbnailFile, thumbnailSignedUrl, getSignal()); onUploaded?.(); return true; }
        catch (error) { if (error instanceof DOMException && error.name === "AbortError") throw error; toast.error("サムネイルのアップロードに失敗しました"); return false; }
    };
    const itemImageUpload = async ({ itemImageFiles, itemImageSignedUrls, onUploaded }: ItemImageArgs): Promise<boolean> => {
        try {
            const signal = getSignal();
            await Promise.all(itemImageFiles.map(async (image, index) => {
                if (image.uploaded) return;
                const url = itemImageSignedUrls.find((entry) => entry.index === index)?.url;
                if (!image.file || !url) throw new Error("商品画像のアップロード情報が不足しています");
                await put(image.file, url, signal);
                onUploaded?.(image.id);
            }));
            return true;
        } catch (error) { if (error instanceof DOMException && error.name === "AbortError") throw error; toast.error("商品画像のアップロードに失敗しました"); return false; }
    };
    const attributesImageUpload = async ({ attributesValue, signedUrlMap, onUploaded }: AttributesImageArgs): Promise<boolean> => {
        try {
            const signal = getSignal();
            await Promise.all(attributesValue.colorVariants.map(async (variant) => {
                if (variant.image_uploaded) return;
                const url = signedUrlMap?.[variant._uiId];
                if (!variant.image || !url) throw new Error("属性画像のアップロード情報が不足しています");
                await put(variant.image, url, signal);
                onUploaded?.(variant._uiId);
            }));
            return true;
        } catch (error) { if (error instanceof DOMException && error.name === "AbortError") throw error; toast.error("商品画像のアップロードに失敗しました"); return false; }
    };
    return { videoUploadAndConvert, thumbnailUpload, itemImageUpload, attributesImageUpload, cancelUploads };
};
