import { useCallback } from "react";
import toast from "react-hot-toast";
import { fetchDraftVideoConvert, fetchVideoConvert } from "../api/video";
import type { PresignedPost } from "../api/item";
import { AttributesValue } from "../attributes";
import { ItemImageValue } from "../itemImage";

type SignedUrlItem = {
    index: number;
    url: string;
};

type VideoArgs = {
    videoFile: File | null;
    videoSignedUrl: PresignedPost | null;
} & (
    | { target: "editing"; itemEditingId: string }
    | { target: "draft"; itemDraftId: number }
);

type ThumbnailArgs = {
    thumbnailFile: File | null;
    thumbnailSignedUrl: string | null;
};

type ItemImageArgs = {
    itemImageFiles: ItemImageValue[];
    itemImageSignedUrls: SignedUrlItem[];
};

type AttributesImageArgs = {
    attributesValue: AttributesValue;
    signedUrlMap: Record<string, string> | null | undefined;
};

export const useFileUpload = () => {
    // 動画
    const videoUploadAndConvert = useCallback(
        async (args: VideoArgs): Promise<boolean> => {
            const { videoFile, videoSignedUrl } = args;
            if (!videoSignedUrl || !(videoFile instanceof File)) {
                return true;
            }

            // s3直接アップロード
            const formData = new FormData();
            Object.entries(videoSignedUrl.fields).forEach(([name, value]) => {
                formData.append(name, value);
            });
            formData.append("file", videoFile);

            const uploadRes = await fetch(videoSignedUrl.url, {
                method: "POST",
                body: formData,
            });

            if (!uploadRes.ok) {
                toast.error("動画のアップロードに失敗しました");
                return false;
            }

            // ffmpeg変換
            if (args.target === "draft") {
                await fetchDraftVideoConvert(args.itemDraftId);
            } else {
                await fetchVideoConvert(args.itemEditingId);
            }

            return true;
        },
        [],
    );

    // サムネイル
    const thumbnailUpload = useCallback(
        async ({ thumbnailFile, thumbnailSignedUrl }: ThumbnailArgs): Promise<boolean> => {
            if (!thumbnailSignedUrl || !(thumbnailFile instanceof File)) {
                return true;
            }

            const thumbnailRes = await fetch(thumbnailSignedUrl, {
                method: "PUT",
                headers: {
                    "Content-Type": thumbnailFile.type,
                },
                body: thumbnailFile,
            });

            if (!thumbnailRes.ok) {
                toast.error("サムネイルのアップロードに失敗しました");
                return false;
            }

            return true;
        },
        [],
    );

    // 商品画像
    const itemImageUpload = useCallback(
        async ({ itemImageFiles, itemImageSignedUrls }: ItemImageArgs): Promise<boolean> => {
            if (itemImageSignedUrls.length === 0) {
                return true;
            }

            try {
                await Promise.all(
                    itemImageSignedUrls.map(async ({ index, url }) => {
                        const target = itemImageFiles[index];

                        if (!target || target.uploaded || !(target.file instanceof File)) {
                            return;
                        }

                        const res = await fetch(url, {
                            method: "PUT",
                            headers: {
                                "Content-Type": target.file.type,
                            },
                            body: target.file,
                        });

                        if (!res.ok) {
                            throw new Error(`画像${index + 1}枚目のアップロードに失敗`);
                        }
                    }),
                );

                return true;
            } catch (err) {
                toast.error("商品画像のアップロードに失敗しました");
                return false;
            }
        },
        [],
    );

    // attributes.image
    const attributesImageUpload = useCallback(
        async ({ attributesValue, signedUrlMap }: AttributesImageArgs): Promise<boolean> => {
            if (!signedUrlMap || Object.keys(signedUrlMap).length === 0) {
                return true;
            }

            const uploadTarget = attributesValue.colorVariants
                .map((v) => v.image)
                .filter((img): img is File => img instanceof File);

            const imageUrls = Object.values(signedUrlMap);

            try {
                await Promise.all(
                    imageUrls.map(async (signedUrl, i) => {
                        const target = uploadTarget[i];

                        if (!target) {
                            console.warn(`画像${i + 1}枚目が見つかりません。スキップします。`);
                            return;
                        }

                        const res = await fetch(signedUrl, {
                            method: "PUT",
                            headers: {
                                "Content-Type": target.type,
                            },
                            body: target,
                        });

                        if (!res.ok) {
                            throw new Error(`属性画像 ${i + 1}枚目のアップロードに失敗`);
                        }
                    }),
                );

                return true;
            } catch (err) {
                toast.error("商品画像のアップロードに失敗しました");
                return false;
            }
        },
        [],
    );

    return {
        videoUploadAndConvert,
        thumbnailUpload,
        itemImageUpload,
        attributesImageUpload,
    };
};
