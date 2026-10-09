import { randomUUID } from "node:crypto";
import { publicS3Domain } from "../../../infra/aws/s3.js";
import { SignedUrlWithIndex } from "../../../infra/aws/type.js";
import { ItemEditing } from "../../../models/index.js";
import { createVideoPresignedPost, generateSignedUrl } from "../../../utils/s3/index.js";
import { ItemEditingConfirmBody } from "../../../validators/body/itemEditing.js";

type Params = {
    itemEditingId: number;
    userId: number;
    itemEditing: InstanceType<typeof ItemEditing>;
    body: ItemEditingConfirmBody;
};

export const buildSignedUrls = async ({ itemEditingId, userId, itemEditing, body }: Params) => {
    const { video, thumbnail, itemImages, attributes } = body;

    const now = Date.now();
    const requestId = randomUUID();

    // 動画署名付きURL生成
    let videoSignedUrl: Awaited<ReturnType<typeof createVideoPresignedPost>> | null = null;
    let videoUrl: string | null = itemEditing.converted_url ?? itemEditing.original_url ?? null;

    if (video?.name && !video.uploaded && video.type) {
        const originalKey = `video/original/${userId}/${itemEditingId}_${now}_${requestId}`;

        videoSignedUrl =
            (await createVideoPresignedPost({
                key: originalKey,
                contentType: video.type,
                contentLengthRange: 500 * 1024 * 1024,
            })) ?? null;

        videoUrl = `${publicS3Domain}/${originalKey}`;
    }

    // サムネイル署名付きURL生成
    let thumbnailSignedUrl: string | null = null;
    let thumbnailUrl: string | null = itemEditing.thumbnail_url ?? null;

    if (thumbnail?.name && !thumbnail.uploaded && thumbnail.type) {
        const key = `thumbnail/${userId}/${itemEditingId}_${now}_${requestId}`;

        thumbnailSignedUrl = await generateSignedUrl({ key, contentType: thumbnail.type });

        thumbnailUrl = `${publicS3Domain}/${key}`;
    }

    // 商品画像署名付きURL生成
    const existingImages = Array.isArray(itemEditing.image_url) ? itemEditing.image_url : [];

    let itemImageSignedUrls: SignedUrlWithIndex[] = [];
    const newUploadedUrls: string[] = []; // 新規用
    const finalImageUrls: string[] = []; // DB保存用

    await Promise.all(
        (itemImages ?? []).map(async (img, index) => {
            if (!img || img.uploaded || !img.type) return;

            const key = `item-image/${userId}/${itemEditingId}_${index}_${now}_${requestId}`;

            const signedUrl = await generateSignedUrl({ key, contentType: img.type });

            itemImageSignedUrls[index] = {
                index,
                url: signedUrl,
            };

            newUploadedUrls[index] = `${publicS3Domain}/${key}`;
        }),
    );

    // 並行処理中に配列を詰めると、後から完了した元indexへの代入で署名が上書きされる。
    itemImageSignedUrls = itemImageSignedUrls.filter((v): v is SignedUrlWithIndex => v != null);

    (itemImages ?? []).forEach((img, i) => {
        if (!img) return;

        if (img.uploaded) {
            const existingUrl = existingImages[i];
            if (existingUrl) finalImageUrls.push(existingUrl);
        } else {
            const newUrl = newUploadedUrls[i];
            if (newUrl) finalImageUrls.push(newUrl);
        }
    });

    // attributes.image署名付きURL生成
    const existingVariants = Array.isArray(itemEditing.attributes?.colorVariants)
        ? itemEditing.attributes.colorVariants
        : [];

    const existingVariantMap = new Map<string, string>();

    existingVariants.forEach((variant: any) => {
        if (variant.uiId && variant.image_url) {
            existingVariantMap.set(variant.uiId, variant.image_url);
        }
    });

    const attributesImageSignedUrls: Record<string, string> = {};
    const attributesImageUrls: Record<string, string> = {};

    const attributesTargets = attributes.colorVariants.filter((v) => v.image && v.image.name && !v.image.uploaded);

    await Promise.all(
        attributesTargets.map(async (v) => {
            if (!v.image || !v.image.type) return;

            const key = `attributes/${userId}/${itemEditingId}_${v.uiId}_${now}_${requestId}`;

            const signedUrl = await generateSignedUrl({ key, contentType: v.image?.type });

            attributesImageSignedUrls[v.uiId] = signedUrl;
            attributesImageUrls[v.uiId] = `${publicS3Domain}/${key}`;
        }),
    );

    const finalAttributesImageUrls: Record<string, string> = {};

    for (const v of attributes.colorVariants) {
        if (v.image && !v.image.uploaded) {
            const newUrl = attributesImageUrls[v.uiId];
            if (newUrl) {
                finalAttributesImageUrls[v.uiId] = newUrl;
            }
        } else {
            const existingUrl = existingVariantMap.get(v.uiId);
            if (existingUrl) {
                finalAttributesImageUrls[v.uiId] = existingUrl;
            }
        }
    }

    return {
        videoSignedUrl,
        videoUrl,
        thumbnailSignedUrl,
        thumbnailUrl,
        itemImageSignedUrls,
        finalImageUrls,
        attributesImageSignedUrls,
        finalAttributesImageUrls,
    };
};
