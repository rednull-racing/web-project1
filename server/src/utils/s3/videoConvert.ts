import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { buckets, s3 } from "../../infra/aws/s3.js";
import fs from "fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AppError } from "../../errors.js";

type DownloadParams = {
    key: string;
    filePath: string;
};

type UploadParams = {
    key: string;
    filePath: string;
    contentType: string;
};

export const downloadVideoFromS3 = async ({ key, filePath }: DownloadParams) => {
    const getObjectCommand = new GetObjectCommand({
        Bucket: buckets.public,
        Key: key,
    });

    const s3Object = await s3.send(getObjectCommand);
    if (!(s3Object.Body instanceof Readable)) {
        throw new AppError("S3_OBJECT_BODY_INVALID", 500);
    }

    await pipeline(s3Object.Body, fs.createWriteStream(filePath));
};

export const uploadVideoToS3 = async ({ filePath, key, contentType }: UploadParams) => {
    await s3.send(
        new PutObjectCommand({
            Bucket: buckets.public,
            Key: key,
            Body: fs.createReadStream(filePath),
            ContentType: contentType,
        }),
    );
};
