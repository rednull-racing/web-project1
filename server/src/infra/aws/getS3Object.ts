import { GetObjectCommand } from "@aws-sdk/client-s3";
import { AppError } from "../../errors.js";
import { s3 } from "./s3.js";
import { Readable } from "node:stream";

type Params = {
    bucketName?: string;
    objectKey: string;
    versionId?: string | null;
};

export const getS3Object = async ({ bucketName, objectKey, versionId }: Params) => {
    if (!bucketName) throw new AppError("S3_BUCKET_NOT_FOUND", 404);

    const result = await s3.send(
        new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            VersionId: versionId ?? undefined,
        }),
    );

    if (!(result.Body instanceof Readable)) {
        throw new AppError("S3_OBJECT_BODY_INVALID", 500);
    }

    return {
        body: result.Body,
        contentType: result.ContentType ?? null,
        contentLength: result.ContentLength ?? null,
        etag: result.ETag ?? null,
        versionId: result.VersionId ?? null,
    };
};
