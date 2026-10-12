import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { AppError } from "../../errors.js";
import { buckets, s3 } from "../../infra/aws/s3.js";

type PresignedParams = {
    key: string;
    contentType: string;
    contentLengthRange: number;
};

export const createVideoPresignedPost = async ({ key, contentType, contentLengthRange }: PresignedParams) => {
    const bucket = buckets.public;
    if (!bucket) {
        throw new AppError("VIDEO_SIGNED_URL_UNAVAILABLE", 500, "動画のアップロード準備ができませんでした。もう一度お試しください。");
    }

    const presignedUrl = await createPresignedPost(s3, {
        Bucket: bucket,
        Key: key,

        Conditions: [
            ["content-length-range", 0, contentLengthRange],
            ["starts-with", "$Content-Type", contentType],
        ],

        Fields: {
            "Content-Type": "video/mp4",
        },

        Expires: 60,
    });

    return presignedUrl;
};
