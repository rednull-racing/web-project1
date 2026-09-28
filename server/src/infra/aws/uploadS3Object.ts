import { PutObjectCommand } from "@aws-sdk/client-s3";
import { AppError } from "../../errors.js";
import { s3 } from "./s3.js";

type Params = {
    bucketName?: string;
    objectKey: string;
    body: Buffer;
    contentType?: string;
};

export const uploadS3Object = async ({ bucketName, objectKey, body, contentType }: Params) => {
    if (!bucketName) throw new AppError("S3_BUCKET_NOT_FOUND", 404);

    const result = await s3.send(
        new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            Body: body,
            ContentType: contentType,
        }),
    );

    return {
        bucketName,
        objectKey,
        etag: result.ETag ?? null,
        versionId: result.VersionId ?? null,
    };
};
